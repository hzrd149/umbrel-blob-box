import type { RouterTypes } from "bun";
import { existsSync } from "fs";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import Document from "../../components/Document";
import { BackIcon, ErrorIcon, SettingsIcon } from "../../components/icons";
import { APP_HIDDEN_SERVICE, BLOB_DIR } from "../../env";
import appConfig from "../../services/config";
import { getDirectoryContents, getParentPath } from "../../utils/fileSystem";
import Breadcrumb from "./components/Breadcrumb";
import FileList from "./components/FileList";
import FileUpload from "./components/FileUpload";
import TorInfoBanner from "./components/TorInfoBanner";

interface FileBrowserProps {
  path: string;
  files: Array<{
    name: string;
    isDirectory: boolean;
    hash?: string;
    size?: number;
    mtime?: number;
  }>;
  error?: string;
  uploadError?: string;
}

function FileBrowser({ path, files, error, uploadError }: FileBrowserProps) {
  const parentPath = getParentPath(path);
  const hasParent = path !== "/" && path !== "";

  const allowAnonymous = appConfig.getConfig().allowAnonymous;

  if (error) {
    return (
      <div class="max-w-6xl mx-auto p-8">
        <div class="mb-8">
          <h1 class="text-4xl font-bold text-primary mb-4">Blob Box Browser</h1>
          <Breadcrumb path={path} />
        </div>
        <div class="alert alert-error">
          <ErrorIcon />
          <span safe>Error: {error}</span>
        </div>
      </div>
    );
  }

  return (
    <div class="max-w-6xl mx-auto p-8">
      <div class="mb-4">
        <div class="flex justify-between items-center mb-4">
          <h1 class="text-4xl font-bold text-primary">Blob Box</h1>
          <a href="/admin" class="btn btn-ghost">
            <SettingsIcon />
            Admin
          </a>
        </div>
        <Breadcrumb path={path} />
      </div>

      {APP_HIDDEN_SERVICE && !hasParent ? (
        <TorInfoBanner hiddenServiceUrl={APP_HIDDEN_SERVICE} />
      ) : null}

      {uploadError && (
        <div class="alert alert-error mb-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="stroke-current shrink-0 h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span safe>Upload failed: {uploadError}</span>
        </div>
      )}

      {hasParent && (
        <div class="bg-base-100 border border-base-300 rounded-box overflow-hidden">
          <a
            href={`/${parentPath !== "/" ? `?path=${encodeURIComponent(parentPath)}` : ""}`}
            class="flex items-center gap-4 p-4 hover:bg-base-200 transition-colors bg-base-200/50"
          >
            <div class="flex p-2 items-center justify-center w-10 h-10 rounded-lg bg-base-300 text-base-content">
              <BackIcon />
            </div>
            <div class="flex-1">
              <div class="font-semibold text-base-content">..</div>
              <div class="text-sm text-base-content/70">Parent Directory</div>
            </div>
          </a>
        </div>
      )}

      {files.length === 0 ? (
        <div class="text-center py-16 text-base-content/60">
          <svg
            class="mx-auto h-12 w-12 mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2z"
            />
          </svg>
          <p class="text-lg italic">This directory is empty.</p>
        </div>
      ) : (
        <FileList files={files} currentPath={path} />
      )}

      {allowAnonymous && <FileUpload currentPath={path} />}
    </div>
  );
}

async function fileBrowser(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const requestedPath = searchParams.get("path") ?? "";
  const uploadError = searchParams.get("error");
  const normalizedPath = join("/", requestedPath);

  let files: Array<{
    name: string;
    isDirectory: boolean;
    hash?: string;
    size?: number;
    mtime?: number;
  }> = [];
  let error: string | undefined;

  try {
    files = await getDirectoryContents(normalizedPath);
  } catch (e) {
    error = e instanceof Error ? e.message : "Unknown error occurred";
  }

  return new Response(
    await (
      <Document title={`Blob Box - ${normalizedPath}`}>
        <FileBrowser
          path={normalizedPath}
          files={files}
          error={error}
          uploadError={uploadError || undefined}
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

async function handleFileUpload(req: Request): Promise<Response> {
  let path = "/";
  try {
    const formData = await req.formData();
    path = (formData.get("path") as string) || "/";

    // Check if anonymous uploads are allowed
    const allowAnonymous = appConfig.get("allowAnonymous") || false;
    if (!allowAnonymous) {
      const redirectPath =
        path === "/" ? "/" : `/?path=${encodeURIComponent(path)}`;
      return new Response(null, {
        status: 302,
        headers: {
          Location: `${redirectPath}${redirectPath.includes("?") ? "&" : "?"}error=${encodeURIComponent("Anonymous uploads are not allowed")}`,
        },
      });
    }
    const fileEntries = formData.getAll("files");

    // Filter to ensure we only have File objects and cast them properly
    const files: File[] = [];
    for (const entry of fileEntries) {
      if (entry instanceof File) {
        files.push(entry);
      }
    }

    if (!files || files.length === 0) {
      return new Response(JSON.stringify({ error: "No files provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const uploadPath = join(BLOB_DIR, path === "/" ? "" : path);

    // Ensure the upload directory exists
    if (!existsSync(uploadPath)) {
      await mkdir(uploadPath, { recursive: true });
    }

    let uploadedCount = 0;
    const results = [];

    for (const file of files) {
      if (file.size === 0) continue; // Skip empty files

      try {
        const filePath = join(uploadPath, file.name);
        const arrayBuffer = await file.arrayBuffer();
        const buffer = new Uint8Array(arrayBuffer);

        await writeFile(filePath, buffer);
        uploadedCount++;
        results.push({
          name: file.name,
          size: file.size,
          success: true,
        });
      } catch (error) {
        results.push({
          name: file.name,
          size: file.size,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    // Redirect back to the current directory after successful upload
    const redirectPath =
      path === "/" ? "/" : `/?path=${encodeURIComponent(path)}`;
    return new Response(null, {
      status: 302,
      headers: { Location: redirectPath },
    });
  } catch (error) {
    // For errors, we could redirect to an error page or show a simple error message
    // For now, let's redirect back with an error parameter
    const redirectPath =
      path === "/" ? "/" : `/?path=${encodeURIComponent(path)}`;
    const errorMessage =
      error instanceof Error ? error.message : "Upload failed";
    return new Response(null, {
      status: 302,
      headers: {
        Location: `${redirectPath}${redirectPath.includes("?") ? "&" : "?"}error=${encodeURIComponent(errorMessage)}`,
      },
    });
  }
}

const routes: Record<
  string,
  RouterTypes.RouteHandler<any> | RouterTypes.RouteHandlerObject<any>
> = {
  "/": fileBrowser,
  "/api/upload": {
    POST: handleFileUpload,
  },
};

export default routes;
