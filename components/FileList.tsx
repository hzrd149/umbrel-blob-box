import { join } from "path";
import { FileIcon, FolderIcon } from "./icons";

interface FileEntry {
  name: string;
  isDirectory: boolean;
  hash?: string;
  size?: number;
  mtime?: number;
}

interface FileListProps {
  files: FileEntry[];
  currentPath: string;
}

function DirectoryItem({
  name,
  currentPath,
}: {
  name: string;
  currentPath: string;
}) {
  const newPath = join(currentPath, name);
  const searchParams = new URLSearchParams();
  if (newPath !== "/") searchParams.set("path", newPath);

  const href = `/${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;

  return (
    <a
      href={href}
      class="flex items-center gap-4 p-4 hover:bg-base-200 transition-colors border-b border-base-300 last:border-b-0"
    >
      <div class="flex p-2 items-center justify-center w-10 h-10 rounded-lg bg-warning/10 text-warning">
        <FolderIcon />
      </div>
      <div class="flex-1 min-w-0">
        <div class="font-semibold text-base-content" safe>
          {name}
        </div>
        <div class="text-sm text-base-content/70">Directory</div>
      </div>
    </a>
  );
}

function FileItem({
  name,
  hash,
  size,
  mtime,
}: {
  name: string;
  hash: string;
  size: number;
  mtime: number;
}) {
  const extension = name.split(".").pop();
  const href = `/${hash}${extension ? `.${extension}` : ""}`;
  const sizeFormatted = formatFileSize(size);
  const dateFormatted = new Date(mtime).toLocaleDateString();

  return (
    <a
      href={href}
      class="flex items-center gap-4 p-4 hover:bg-base-200 transition-colors border-b border-base-300 last:border-b-0"
    >
      <div class="flex p-2 items-center justify-center w-10 h-10 rounded-lg bg-info/10 text-info">
        <FileIcon />
      </div>
      <div class="flex-1 flex flex-col gap-1 overflow-hidden">
        <div class="flex gap-2 overflow-hidden">
          <div class="font-semibold text-base-content break-all truncate" safe>
            {name}
          </div>
          <div class="text-sm text-base-content/70 ms-auto" safe>
            {sizeFormatted} • {dateFormatted}
          </div>
        </div>
        <div class="text-sm text-base-content/50 font-mono break-all" safe>
          {hash}
        </div>
      </div>
    </a>
  );
}

function formatFileSize(bytes: number): string {
  const sizes = ["B", "KB", "MB", "GB"];
  if (bytes === 0) return "0 B";
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + " " + sizes[i];
}

export default function FileList({ files, currentPath }: FileListProps) {
  const directories = files
    .filter((f) => f.isDirectory)
    .sort((a, b) => a.name.localeCompare(b.name));
  const regularFiles = files
    .filter((f) => !f.isDirectory)
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div class="bg-base-100 border border-base-300 rounded-box overflow-hidden">
      {directories.map((dir) => (
        <DirectoryItem name={dir.name} currentPath={currentPath} />
      ))}
      {regularFiles.map((file) => (
        <FileItem
          name={file.name}
          hash={file.hash!}
          size={file.size!}
          mtime={file.mtime!}
        />
      ))}
    </div>
  );
}
