import { nip19 } from "nostr-tools";
import Document from "../../components/Document";
import type { AppConfig } from "../../services/config";
import appConfig from "../../services/config";
import {
  AlertMessage,
  DangerZone,
  GeneralSettings,
  Navigation,
  WhitelistManagement,
} from "./components";

/**
 * Parse a public key from various formats (hex, npub, nprofile)
 * Returns the hex public key or throws an error
 */
function parsePublicKey(input: string): string {
  const trimmed = input.trim();

  // Check if it's already a valid hex key
  if (/^[a-fA-F0-9]{64}$/.test(trimmed)) return trimmed.toLowerCase();

  // Try to decode as NIP-19
  try {
    const decoded = nip19.decode(trimmed);

    if (decoded.type === "npub") return decoded.data;
    if (decoded.type === "nprofile") return decoded.data.pubkey;

    throw new Error(`Unsupported NIP-19 type: ${decoded.type}`);
  } catch (nip19Error) {
    // If NIP-19 decoding fails, provide a helpful error message
    if (trimmed.startsWith("npub") || trimmed.startsWith("nprofile")) {
      throw new Error(
        `Invalid NIP-19 format: ${nip19Error instanceof Error ? nip19Error.message : "decode failed"}`,
      );
    }

    throw new Error(
      "Public key must be 64-character hex, npub, or nprofile format",
    );
  }
}

interface AdminDashboardProps {
  config: AppConfig;
  message?: string;
  error?: string;
}

function AdminDashboard({ config, message, error }: AdminDashboardProps) {
  return (
    <div class="max-w-4xl mx-auto p-8">
      <div class="mb-8">
        <h1 class="text-4xl font-bold text-primary mb-4">Admin Dashboard</h1>
        <p class="text-base-content/70">Manage your Blob Box configuration</p>
      </div>

      <AlertMessage message={message} error={error} />

      <div class="grid gap-8">
        <GeneralSettings config={config} />
        <WhitelistManagement whitelist={config.whitelist} />
        <DangerZone />
        <Navigation />
      </div>
    </div>
  );
}

// Admin dashboard route handler
export async function adminDashboard(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const message = url.searchParams.get("message");
  const error = url.searchParams.get("error");

  const config = appConfig.getConfig();

  return new Response(
    await (
      <Document title="Admin Dashboard - Blob Box">
        <AdminDashboard
          config={config}
          message={message || undefined}
          error={error || undefined}
        />
      </Document>
    ),
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    },
  );
}

// API endpoint handlers
export async function updateSettings(req: Request): Promise<Response> {
  try {
    const formData = await req.formData();
    const maxFileSizeMB =
      parseInt(formData.get("maxFileSize") as string) || 100;
    const allowAnonymous = formData.has("allowAnonymous");

    await appConfig.updateConfig({
      maxFileSize: maxFileSizeMB * 1024 * 1024, // Convert MB to bytes
      allowAnonymous,
    });

    return new Response(null, {
      status: 302,
      headers: {
        Location: "/admin?message=Settings updated successfully",
      },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return new Response(null, {
      status: 302,
      headers: {
        Location: `/admin?error=${encodeURIComponent(errorMessage)}`,
      },
    });
  }
}

export async function addToWhitelist(req: Request): Promise<Response> {
  try {
    const formData = await req.formData();
    const pubkeyInput = formData.get("pubkey") as string;

    if (!pubkeyInput) throw new Error("Public key is required");

    // Parse the public key from various formats
    const hexPubkey = parsePublicKey(pubkeyInput);

    await appConfig.addToWhitelist(hexPubkey);

    return new Response(null, {
      status: 302,
      headers: {
        Location: "/admin?message=Public key added to whitelist",
      },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return new Response(null, {
      status: 302,
      headers: {
        Location: `/admin?error=${encodeURIComponent(errorMessage)}`,
      },
    });
  }
}

export async function removeFromWhitelist(req: Request): Promise<Response> {
  try {
    const formData = await req.formData();
    const pubkey = formData.get("pubkey") as string;

    if (!pubkey) {
      throw new Error("Public key is required");
    }

    await appConfig.removeFromWhitelist(pubkey);

    return new Response(null, {
      status: 302,
      headers: {
        Location: "/admin?message=Public key removed from whitelist",
      },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return new Response(null, {
      status: 302,
      headers: {
        Location: `/admin?error=${encodeURIComponent(errorMessage)}`,
      },
    });
  }
}

export async function resetConfig(req: Request): Promise<Response> {
  try {
    await appConfig.resetToDefaults();

    return new Response(null, {
      status: 302,
      headers: {
        Location: "/admin?message=Configuration reset to defaults",
      },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return new Response(null, {
      status: 302,
      headers: {
        Location: `/admin?error=${encodeURIComponent(errorMessage)}`,
      },
    });
  }
}

import { withSimpleAuth } from "../../utils/auth";

// Route configuration with CORS applied
const routes = {
  "/admin": {
    GET: withSimpleAuth()(adminDashboard),
  },
  "/admin/update-settings": {
    POST: withSimpleAuth()(updateSettings),
  },
  "/admin/add-whitelist": {
    POST: withSimpleAuth()(addToWhitelist),
  },
  "/admin/remove-whitelist": {
    POST: withSimpleAuth()(removeFromWhitelist),
  },
  "/admin/reset-config": {
    POST: withSimpleAuth()(resetConfig),
  },
};

export default routes;
