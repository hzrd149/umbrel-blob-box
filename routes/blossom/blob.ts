import { statSync } from "fs";
import blobStorage from "../../services/storage.ts";
import {
  createCorsErrorResponse,
  createCorsResponse,
  handleCorsPreflightRequest,
  withCors,
} from "../../utils/cors.ts";
import { createAuthErrorResponse, isValidSha256 } from "../../utils/nostr.ts";
import { validateAuthorization } from "./auth.ts";
import {
  createBlobHeaders,
  findBlobByHash,
  getMimeType,
  handleInvalidRange,
  handleRangeRequest,
  parseBlobPath,
  parseRangeHeader,
} from "./utils.ts";

/**
 * Handle DELETE /<sha256> - Delete blob with authorization
 */
async function handleDelete(req: Request, hash: string): Promise<Response> {
  // Validate hash format
  if (!isValidSha256(hash)) {
    return createAuthErrorResponse("Invalid SHA256 hash format", 400);
  }

  // Validate authorization with the hash to be deleted
  const authResult = await validateAuthorization(req, "delete", [hash]);
  if (!authResult.success) {
    return authResult.response!;
  }

  try {
    const deleted = await blobStorage.deleteBlobByHash(hash);

    if (!deleted) {
      return createAuthErrorResponse("Blob not found", 404);
    }

    return new Response(
      JSON.stringify({ message: "Blob deleted successfully" }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error("Error handling delete:", error);
    return createAuthErrorResponse("Internal server error", 500);
  }
}

/**
 * Handle GET /:sha256 route - Blob retrieval
 */
async function handleBlobGet(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const pathname = url.pathname;

  const blobInfo = parseBlobPath(pathname);
  if (!blobInfo) {
    return createCorsErrorResponse(
      "Invalid path. Expected /<sha256>[.ext]",
      400,
    );
  }

  // Find the file with this hash
  const foundFilePath = findBlobByHash(blobInfo.hash);
  if (!foundFilePath) {
    return createCorsErrorResponse("Blob not found", 404);
  }

  // Get file stats
  const stats = statSync(foundFilePath);
  const fileSize = stats.size;

  // Determine MIME type
  const mimeType = getMimeType(foundFilePath, blobInfo.extension);

  // Create base headers
  const headers = createBlobHeaders(mimeType, fileSize);

  // Handle GET requests
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

/**
 * Handle HEAD /:sha256 route - Blob metadata
 */
async function handleBlobHead(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const pathname = url.pathname;

  const blobInfo = parseBlobPath(pathname);
  if (!blobInfo) {
    return createCorsErrorResponse(
      "Invalid path. Expected /<sha256>[.ext]",
      400,
    );
  }

  // Find the file with this hash
  const foundFilePath = findBlobByHash(blobInfo.hash);
  if (!foundFilePath) {
    return createCorsErrorResponse("Blob not found", 404);
  }

  // Get file stats
  const stats = statSync(foundFilePath);
  const fileSize = stats.size;

  // Determine MIME type
  const mimeType = getMimeType(foundFilePath, blobInfo.extension);

  // Create base headers
  const headers = createBlobHeaders(mimeType, fileSize);

  return createCorsResponse(null, {
    status: 200,
    headers,
  });
}

/**
 * Handle DELETE /:sha256 route
 */
async function handleBlobDelete(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const pathname = url.pathname;

  const blobInfo = parseBlobPath(pathname);
  if (!blobInfo) {
    return createCorsErrorResponse(
      "Invalid path. Expected /<sha256>[.ext]",
      400,
    );
  }

  return handleDelete(req, blobInfo.hash);
}

/**
 * Handle CORS preflight requests
 */
async function handleCorsOptions(req: Request): Promise<Response> {
  return handleCorsPreflightRequest();
}

export const blobRoutes = {
  "/:sha256(.+?)": {
    GET: withCors(handleBlobGet),
    HEAD: withCors(handleBlobHead),
    DELETE: withCors(handleBlobDelete),
    OPTIONS: withCors(handleCorsOptions),
  },
};
