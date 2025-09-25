import { join, basename, extname } from "path";
import { existsSync, createReadStream, statSync } from "fs";
import mime from "mime";
import { createHash } from "crypto";
import blobStorage from "../../services/storage.ts";
import appConfig from "../../services/config.ts";
import {
  handleCorsPreflightRequest,
  createCorsErrorResponse,
  createCorsResponse,
  addCorsHeaders,
  withCors,
} from "../../utils/cors.ts";
import {
  parseAuthorizationHeader,
  verifyEventSignature,
  isValidBlossomAuth,
  isValidPubkey,
  isValidSha256,
  createAuthErrorResponse,
  type NostrEvent,
} from "../../utils/nostr.ts";
import { APP_HIDDEN_SERVICE } from "../../env.ts";
import type { RouterTypes } from "bun";

/**
 * Blob descriptor as defined in BUD-02
 */
interface BlobDescriptor {
  url: string;
  sha256: string;
  size: number;
  type: string;
  uploaded: number;
}

/**
 * Create a blob descriptor from file information
 */
function createBlobDescriptor(
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
function determineMimeType(filename?: string, contentType?: string): string {
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
function generateFilename(
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
 * Early validation of authorization (without hash validation)
 * This should be called before processing request body to prevent DoS attacks
 */
async function validateAuthorizationEarly(
  req: Request,
  authType: "upload" | "list" | "delete",
): Promise<
  | { success: true; pubkey: string; event: NostrEvent }
  | { success: false; response: Response }
> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return {
      success: false,
      response: createAuthErrorResponse("Authorization header required"),
    };
  }

  const event = parseAuthorizationHeader(authHeader);
  if (!event) {
    return {
      success: false,
      response: createAuthErrorResponse("Invalid authorization header format"),
    };
  }

  // Verify event signature
  if (!verifyEventSignature(event)) {
    return {
      success: false,
      response: createAuthErrorResponse("Invalid event signature"),
    };
  }

  // Check if it's the correct kind (24242 for Blossom auth)
  if (event.kind !== 24242) {
    return {
      success: false,
      response: createAuthErrorResponse(
        `Invalid ${authType} authorization event`,
      ),
    };
  }

  // Check if it has the correct 't' tag
  const tTag = event.tags.find((tag) => tag[0] === "t");
  if (!tTag || tTag[1] !== authType) {
    return {
      success: false,
      response: createAuthErrorResponse(
        `Invalid ${authType} authorization event`,
      ),
    };
  }

  // Check expiration if present
  const expirationTag = event.tags.find((tag) => tag[0] === "expiration");
  if (expirationTag && expirationTag[1]) {
    const expiration = parseInt(expirationTag[1]);
    if (!isNaN(expiration) && Date.now() / 1000 > expiration) {
      return {
        success: false,
        response: createAuthErrorResponse("Authorization event has expired"),
      };
    }
  }

  // Check if pubkey is whitelisted
  if (!appConfig.isWhitelisted(event.pubkey)) {
    return {
      success: false,
      response: createAuthErrorResponse("Pubkey not whitelisted", 403),
    };
  }

  return { success: true, pubkey: event.pubkey, event };
}

/**
 * Validate that the authorization event contains the expected hash
 * This should be called after processing the request body and calculating the hash
 */
function validateAuthorizationHash(
  event: NostrEvent,
  authType: "upload" | "delete",
  expectedHashes: string[],
): boolean {
  // For upload and delete, check if it has the required 'x' tags with expected hashes
  const xTags = event.tags.filter((tag) => tag[0] === "x");
  if (xTags.length === 0) {
    return false;
  }

  // Check if at least one x tag matches an expected hash
  const xTagValues = xTags
    .map((tag) => tag[1])
    .filter((val): val is string => val !== undefined);
  const hasMatchingHash = expectedHashes.some((hash) =>
    xTagValues.includes(hash),
  );

  return hasMatchingHash;
}

/**
 * Validate authorization for Blossom operations (legacy - kept for non-upload operations)
 */
async function validateAuthorization(
  req: Request,
  authType: "upload" | "list" | "delete",
  expectedHashes?: string[],
): Promise<
  { success: true; pubkey: string } | { success: false; response: Response }
> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return {
      success: false,
      response: createAuthErrorResponse("Authorization header required"),
    };
  }

  const event = parseAuthorizationHeader(authHeader);
  if (!event) {
    return {
      success: false,
      response: createAuthErrorResponse("Invalid authorization header format"),
    };
  }

  // Verify event signature
  if (!verifyEventSignature(event)) {
    return {
      success: false,
      response: createAuthErrorResponse("Invalid event signature"),
    };
  }

  // Check if it's a valid Blossom auth event
  if (!isValidBlossomAuth(event, authType, expectedHashes)) {
    return {
      success: false,
      response: createAuthErrorResponse(
        `Invalid ${authType} authorization event`,
      ),
    };
  }

  // Check if pubkey is whitelisted
  if (!appConfig.isWhitelisted(event.pubkey)) {
    return {
      success: false,
      response: createAuthErrorResponse("Pubkey not whitelisted", 403),
    };
  }

  return { success: true, pubkey: event.pubkey };
}

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
  return createCorsErrorResponse("Invalid range", 416, {
    ...headers,
    "Content-Range": `bytes */${fileSize}`,
  });
}

/**
 * Handle PUT /upload - Upload blob with authorization
 */
async function handleUpload(req: Request): Promise<Response> {
  try {
    // STEP 1: Early authorization validation (before processing request body)
    // This prevents DoS attacks from users with invalid credentials
    const earlyAuthResult = await validateAuthorizationEarly(req, "upload");
    if (!earlyAuthResult.success) {
      return earlyAuthResult.response;
    }

    // STEP 2: Process request body now that we know the user is authorized
    const arrayBuffer = await req.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);

    if (data.length === 0) {
      return createAuthErrorResponse("Empty request body", 400);
    }

    // Check file size limits early
    const maxFileSize = appConfig.get("maxFileSize");
    if (maxFileSize && data.length > maxFileSize) {
      return createAuthErrorResponse(
        `File too large. Maximum size: ${maxFileSize} bytes`,
        413,
      );
    }

    // Calculate hash of the uploaded data
    const hash = createHash("sha256").update(data).digest("hex");

    // STEP 3: Validate that the authorization contains the correct hash
    if (!validateAuthorizationHash(earlyAuthResult.event, "upload", [hash])) {
      return createAuthErrorResponse(
        "Authorization hash does not match uploaded content",
        400,
      );
    }

    // Get content type and determine filename
    const contentType = req.headers.get("Content-Type") || undefined;
    const mimeType = determineMimeType(undefined, contentType);
    const filename = generateFilename(hash, contentType);

    // Store the blob
    const { filePath } = await blobStorage.storeBlobForPubkey(
      earlyAuthResult.pubkey,
      filename,
      data,
    );

    // Create blob descriptor
    const blobDescriptor = createBlobDescriptor(
      hash,
      data.length,
      mimeType,
      Math.floor(Date.now() / 1000),
      filename,
    );

    return new Response(JSON.stringify(blobDescriptor), {
      status: 200,
      headers: addCorsHeaders({
        "Content-Type": "application/json",
      }),
    });
  } catch (error) {
    console.error("Error handling upload:", error);
    return createAuthErrorResponse("Internal server error", 500);
  }
}

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
    return authResult.response;
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
        headers: addCorsHeaders({
          "Content-Type": "application/json",
        }),
      },
    );
  } catch (error) {
    console.error("Error handling delete:", error);
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
 * Handle PUT /upload route
 */
async function handleUploadRoute(req: Request): Promise<Response> {
  return handleUpload(req);
}

/**
 * Handle GET /list/:pubkey route
 */
async function handleListRoute(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const pathname = url.pathname;

  // Extract pubkey from URL - Bun should pass it as req.params.pubkey but fallback to manual parsing
  const pubkey = (req as any).params?.pubkey || pathname.slice(6); // Remove "/list/"
  return handleList(req, pubkey);
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

const routes: Record<
  string,
  RouterTypes.RouteHandler<any> | RouterTypes.RouteHandlerObject<any>
> = {
  "/upload": {
    PUT: withCors(handleUploadRoute),
    OPTIONS: withCors(handleCorsOptions),
  },
  "/list/:pubkey": {
    GET: withCors(handleListRoute),
    OPTIONS: withCors(handleCorsOptions),
  },
  "/:sha256(.+?)": {
    GET: withCors(handleBlobGet),
    HEAD: withCors(handleBlobHead),
    DELETE: withCors(handleBlobDelete),
    OPTIONS: withCors(handleCorsOptions),
  },
};

export default routes;
