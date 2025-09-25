import Document from "../../components/Document";
import FileList from "./components/FileList";
import Breadcrumb from "./components/Breadcrumb";
import TorInfoBanner from "./components/TorInfoBanner";
import { join } from "path";
import { getDirectoryContents, getParentPath } from "../../utils/fileSystem";
import { BackIcon } from "../../components/icons";
import { APP_HIDDEN_SERVICE } from "../../env";

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
          <h1 class="text-4xl font-bold text-primary mb-4">Blob Box Browser</h1>
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
        <div class="flex justify-between items-center mb-4">
          <h1 class="text-4xl font-bold text-primary">Blob Box Browser</h1>
          <a href="/admin" class="btn btn-ghost">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              class="size-5"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"
              />
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
              />
            </svg>
            Admin
          </a>
        </div>
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
      <Document title={`Blob Box - ${normalizedPath}`}>
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
