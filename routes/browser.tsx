import Document from "../components/Document";
import FileList from "../components/FileList";
import Breadcrumb from "../components/Breadcrumb";
import TorInfoBanner from "../components/TorInfoBanner";
import { join } from "path";
import { getDirectoryContents, getParentPath } from "../utils/fileSystem";
import { BackIcon } from "../components/icons";
import { APP_HIDDEN_SERVICE } from "../env";

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
}

function FileBrowser({ path, files, error }: FileBrowserProps) {
  const parentPath = getParentPath(path);
  const hasParent = path !== "/" && path !== "";

  if (error) {
    return (
      <div class="max-w-6xl mx-auto p-8">
        <div class="mb-8">
          <h1 class="text-4xl font-bold text-primary mb-4">File Browser</h1>
          <Breadcrumb path={path} />
        </div>
        <div class="alert alert-error">
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
          <span safe>Error: {error}</span>
        </div>
      </div>
    );
  }

  return (
    <div class="max-w-6xl mx-auto p-8">
      <div class="mb-4">
        <h1 class="text-4xl font-bold text-primary mb-4">Blob Browser</h1>
        <Breadcrumb path={path} />
      </div>

      {APP_HIDDEN_SERVICE && !hasParent ? (
        <TorInfoBanner hiddenServiceUrl={APP_HIDDEN_SERVICE} />
      ) : null}

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
    </div>
  );
}

export default async function fileBrowser(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const requestedPath = searchParams.get("path") ?? "";
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
      <Document title={`File Browser - ${normalizedPath}`}>
        <FileBrowser path={normalizedPath} files={files} error={error} />
      </Document>
    ),
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    },
  );
}
