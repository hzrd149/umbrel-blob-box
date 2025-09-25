import { createReadStream, existsSync, statSync } from "fs";
import mime from "mime";
import { basename, extname, join } from "path";
import { APP_HIDDEN_SERVICE } from "../../env.ts";
import blobStorage from "../../services/storage.ts";
import {
  addCorsHeaders,
  createCorsErrorResponse,
  createCorsResponse,
} from "../../utils/cors.ts";
import type { BlobDescriptor, BlobPathInfo, RangeInfo } from "./types.ts";

/**
 * Create a blob descriptor from file information
 */
export function createBlobDescriptor(
  hash: string,
  size: number,
  mimeType: string,
  uploaded: number,
  filename?: string,
): BlobDescriptor {
  const baseUrl = APP_HIDDEN_SERVICE || "http://localhost:3000";
  const extension = filename ? extname(filename) : "";

  return {
    url: `${baseUrl}/${hash}${extension}`,
    sha256: hash,
    size,
    type: mimeType,
    uploaded,
  };
}

/**
 * Determine MIME type from filename or content type header
 */
export function determineMimeType(
  filename?: string,
  contentType?: string,
): string {
  if (contentType && contentType !== "application/octet-stream") {
    return contentType;
  }

  if (filename) {
    const mimeType = mime.getType(filename);
    if (mimeType) return mimeType;
  }

  return "application/octet-stream";
}

/**
 * Generate a safe filename from content type and hash
 */
export function generateFilename(
  hash: string,
  contentType?: string,
  originalFilename?: string,
): string {
  if (originalFilename) {
    return originalFilename;
  }

  let extension = "";
  if (contentType) {
    const ext = mime.getExtension(contentType);
    if (ext) extension = `.${ext}`;
  }

  return `${hash}${extension}`;
}

/**
 * Parse SHA256 hash from URL path
 */
export function parseBlobPath(pathname: string): BlobPathInfo | null {
  const pathMatch = pathname.match(/^\/([a-f0-9]{64})(?:\.(.+))?$/);
  if (!pathMatch) return null;

  return {
    hash: pathMatch[1]!,
    extension: pathMatch[2],
  };
}

/**
 * Find file path for a given SHA256 hash
 */
export function findBlobByHash(hash: string): string | null {
  const allHashes = blobStorage.getAllHashes();

  for (const [relativePath, cacheEntry] of Object.entries(allHashes)) {
    if (cacheEntry.hash === hash) {
      const fullPath = join(blobStorage.getBlobDir(), relativePath);
      if (existsSync(fullPath)) {
        return fullPath;
      }
    }
  }

  return null;
}

/**
 * Determine MIME type for a file
 */
export function getMimeType(filePath: string, extension?: string): string {
  let mimeType = mime.getType(filePath) || "application/octet-stream";

  // If file extension was provided in URL, use that for MIME type determination
  if (extension) {
    const extMimeType = mime.getType(`.${extension}`);
    if (extMimeType) {
      mimeType = extMimeType;
    }
  }

  return mimeType;
}

/**
 * Parse Range header and validate range
 */
export function parseRangeHeader(
  rangeHeader: string,
  fileSize: number,
): RangeInfo | null {
  const rangeMatch = rangeHeader.match(/bytes=(\d+)-(\d*)/);
  if (!rangeMatch || !rangeMatch[1]) {
    return null;
  }

  const start = parseInt(rangeMatch[1]);
  const end =
    rangeMatch[2] && rangeMatch[2] !== ""
      ? parseInt(rangeMatch[2])
      : fileSize - 1;

  // Validate range
  if (start >= 0 && start < fileSize && end >= start && end < fileSize) {
    return { start, end };
  }

  return null;
}

/**
 * Create response headers for blob serving
 */
export function createBlobHeaders(
  mimeType: string,
  fileSize: number,
): Record<string, string> {
  return addCorsHeaders({
    "Content-Type": mimeType,
    "Content-Length": fileSize.toString(),
    "Accept-Ranges": "bytes",
  });
}

/**
 * Handle range request and return partial content
 */
export function handleRangeRequest(
  filePath: string,
  range: RangeInfo,
  headers: Record<string, string>,
  fileSize: number,
): Response {
  const { start, end } = range;
  const contentLength = end - start + 1;

  // Create a readable stream for the range
  const stream = createReadStream(filePath, { start, end });

  return createCorsResponse(stream as any, {
    status: 206,
    headers: {
      ...headers,
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Content-Length": contentLength.toString(),
    },
  });
}

/**
 * Handle invalid range request
 */
export function handleInvalidRange(
  headers: Record<string, string>,
  fileSize: number,
): Response {
  return createCorsErrorResponse("Invalid range", 416, {
    ...headers,
    "Content-Range": `bytes */${fileSize}`,
  });
}
