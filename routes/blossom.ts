import { join } from "path";
import { existsSync, createReadStream, statSync } from "fs";
import mime from "mime";
import blobStorage from "../services/storage.ts";
import {
  handleCorsPreflightRequest,
  createCorsErrorResponse,
  createCorsResponse,
  addCorsHeaders,
} from "../utils/cors.ts";
import type { BunRequest } from "bun";

/**
 * Parse SHA256 hash from URL path
 */
function parseBlobPath(pathname: string): {
  hash: string;
  extension?: string;
} | null {
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
function findBlobByHash(hash: string): string | null {
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
function getMimeType(filePath: string, extension?: string): string {
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
function parseRangeHeader(
  rangeHeader: string,
  fileSize: number,
): { start: number; end: number } | null {
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
function createBlobHeaders(
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
function handleRangeRequest(
  filePath: string,
  range: { start: number; end: number },
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
function handleInvalidRange(
  headers: Record<string, string>,
  fileSize: number,
): Response {
  return createCorsErrorResponse("Invalid range", 416, "Invalid range", {
    ...headers,
    "Content-Range": `bytes */${fileSize}`,
  });
}

/**
 * Main Blossom request handler
 */
export async function handleBlossomRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const pathname = url.pathname;

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return handleCorsPreflightRequest();
  }

  // Parse SHA256 hash from URL path
  const blobInfo = parseBlobPath(pathname);
  if (!blobInfo) {
    return createCorsErrorResponse(
      "Invalid path. Expected /<sha256>[.ext]",
      400,
      "Invalid path format",
    );
  }

  // Find the file with this hash
  const foundFilePath = findBlobByHash(blobInfo.hash);
  if (!foundFilePath) {
    return createCorsErrorResponse("Blob not found", 404, "Blob not found");
  }

  // Get file stats
  const stats = statSync(foundFilePath);
  const fileSize = stats.size;

  // Determine MIME type
  const mimeType = getMimeType(foundFilePath, blobInfo.extension);

  // Create base headers
  const headers = createBlobHeaders(mimeType, fileSize);

  // Handle HEAD requests
  if (req.method === "HEAD") {
    return createCorsResponse(null, {
      status: 200,
      headers,
    });
  }

  // Handle GET requests
  if (req.method === "GET") {
    const rangeHeader = req.headers.get("range");

    if (rangeHeader) {
      // Parse and validate range
      const range = parseRangeHeader(rangeHeader, fileSize);

      if (range) {
        return handleRangeRequest(foundFilePath, range, headers, fileSize);
      } else {
        return handleInvalidRange(headers, fileSize);
      }
    }

    // Regular GET request - return full file
    const file = Bun.file(foundFilePath);
    return createCorsResponse(file, {
      status: 200,
      headers,
    });
  }

  // Method not allowed
  return createCorsErrorResponse(
    "Method not allowed",
    405,
    "Method not allowed",
    { Allow: "GET, HEAD, OPTIONS" },
  );
}
