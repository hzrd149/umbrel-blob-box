import { join, relative, dirname } from "path";
import { readdir, stat } from "fs/promises";
import { existsSync } from "fs";
import blobStorage from "../services/storage.ts";

export interface FileEntry {
  name: string;
  isDirectory: boolean;
  hash?: string;
  size?: number;
  mtime?: number;
}

/**
 * Get directory contents and file information
 */
export async function getDirectoryContents(
  requestedPath: string,
): Promise<FileEntry[]> {
  const blobDir = blobStorage.getBlobDir();
  const fullPath = join(blobDir, requestedPath);

  // Ensure path is within blob directory
  const relativePath = relative(blobDir, fullPath);
  if (relativePath.startsWith("..")) {
    throw new Error("Path outside of blob directory");
  }

  if (!existsSync(fullPath)) {
    return [];
  }

  const stats = await stat(fullPath);
  if (!stats.isDirectory()) {
    return [];
  }

  const entries = await readdir(fullPath, { withFileTypes: true });
  const allHashes = blobStorage.getAllHashes();
  const fileEntries: FileEntry[] = [];

  for (const entry of entries) {
    const entryPath = join(fullPath, entry.name);
    const entryRelativePath = relative(blobDir, entryPath);

    if (entry.isDirectory()) {
      fileEntries.push({
        name: entry.name,
        isDirectory: true,
      });
    } else if (entry.isFile()) {
      const cacheEntry = allHashes[entryRelativePath];
      if (cacheEntry) {
        fileEntries.push({
          name: entry.name,
          isDirectory: false,
          hash: cacheEntry.hash,
          size: cacheEntry.size,
          mtime: cacheEntry.mtime,
        });
      } else {
        // File not in cache, get basic info and trigger refresh
        const entryStats = await stat(entryPath);
        fileEntries.push({
          name: entry.name,
          isDirectory: false,
          size: entryStats.size,
          mtime: entryStats.mtime.getTime(),
        });

        // Trigger async refresh for this file so it gets cached
        blobStorage
          .refreshFile(entryRelativePath)
          .catch((err) =>
            console.error(`Failed to refresh file ${entryRelativePath}:`, err),
          );
      }
    }
  }

  return fileEntries;
}

/**
 * Get parent directory path
 */
export function getParentPath(currentPath: string): string {
  if (currentPath === "/" || currentPath === "") {
    return "/";
  }
  return dirname(currentPath);
}
