import { basename } from "path";
import blobStorage from "../../services/storage.ts";
import {
  addCorsHeaders,
  handleCorsPreflightRequest,
  withCors,
} from "../../utils/cors.ts";
import { createAuthErrorResponse, isValidPubkey } from "../../utils/nostr.ts";
import type { BlobDescriptor } from "./types.ts";
import { createBlobDescriptor, determineMimeType } from "./utils.ts";

/**
 * Handle GET /list/<pubkey> - List blobs for pubkey
 */
async function handleList(req: Request, pubkey: string): Promise<Response> {
  // Validate pubkey format
  if (!isValidPubkey(pubkey)) {
    return createAuthErrorResponse("Invalid pubkey format", 400);
  }

  // Optional: Validate authorization for listing (if required by server config)
  // For now, we'll allow listing without auth, but servers may require it

  try {
    const url = new URL(req.url);
    const since = url.searchParams.get("since");
    const until = url.searchParams.get("until");

    let blobs = blobStorage.getBlobsByPubkey(pubkey);

    // Apply time filters if provided
    if (since) {
      const sinceTimestamp = parseInt(since);
      if (!isNaN(sinceTimestamp)) {
        blobs = blobs.filter((blob) => blob.mtime / 1000 >= sinceTimestamp);
      }
    }

    if (until) {
      const untilTimestamp = parseInt(until);
      if (!isNaN(untilTimestamp)) {
        blobs = blobs.filter((blob) => blob.mtime / 1000 <= untilTimestamp);
      }
    }

    // Convert to blob descriptors
    const blobDescriptors: BlobDescriptor[] = blobs.map((blob) => {
      const filename = basename(blob.relativePath);
      const mimeType = determineMimeType(filename);

      return createBlobDescriptor(
        blob.hash,
        blob.size,
        mimeType,
        Math.floor(blob.mtime / 1000),
        filename,
      );
    });

    return new Response(JSON.stringify(blobDescriptors), {
      status: 200,
      headers: addCorsHeaders({
        "Content-Type": "application/json",
      }),
    });
  } catch (error) {
    console.error("Error handling list:", error);
    return createAuthErrorResponse("Internal server error", 500);
  }
}

/**
 * Handle CORS preflight requests
 */
async function handleCorsOptions(req: Request): Promise<Response> {
  return handleCorsPreflightRequest();
}

/**
 * Handle GET /list/:pubkey route
 */
export async function handleListRoute(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const pathname = url.pathname;

  // Extract pubkey from URL - Bun should pass it as req.params.pubkey but fallback to manual parsing
  const pubkey = (req as any).params?.pubkey || pathname.slice(6); // Remove "/list/"
  return handleList(req, pubkey);
}

export const listRoutes = {
  "/list/:pubkey": {
    GET: withCors(handleListRoute),
    OPTIONS: withCors(handleCorsOptions),
  },
};
