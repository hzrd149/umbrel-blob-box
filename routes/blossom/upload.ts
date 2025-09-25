import { createHash } from "crypto";
import appConfig from "../../services/config.ts";
import blobStorage from "../../services/storage.ts";
import {
  addCorsHeaders,
  handleCorsPreflightRequest,
  withCors,
} from "../../utils/cors.ts";
import { createAuthErrorResponse } from "../../utils/nostr.ts";
import {
  validateAuthorizationEarly,
  validateAuthorizationHash,
} from "./auth.ts";
import {
  createBlobDescriptor,
  determineMimeType,
  generateFilename,
} from "./utils.ts";

/**
 * Handle PUT /upload - Upload blob with authorization
 */
async function handleUpload(req: Request): Promise<Response> {
  try {
    // STEP 1: Early authorization validation (before processing request body)
    // This prevents DoS attacks from users with invalid credentials
    const earlyAuthResult = await validateAuthorizationEarly(req, "upload");
    if (!earlyAuthResult.success) {
      return earlyAuthResult.response!;
    }

    // STEP 2: Process request body now that we know the user is authorized
    const arrayBuffer = await req.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);

    if (data.length === 0)
      return createAuthErrorResponse("Empty request body", 400);

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
    if (!validateAuthorizationHash(earlyAuthResult.event!, "upload", [hash])) {
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
      earlyAuthResult.pubkey!,
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
 * Handle CORS preflight requests
 */
async function handleCorsOptions(req: Request): Promise<Response> {
  return handleCorsPreflightRequest();
}

/**
 * Handle PUT /upload route
 */
export async function handleUploadRoute(req: Request): Promise<Response> {
  return handleUpload(req);
}

export const uploadRoutes = {
  "/upload": {
    PUT: withCors(handleUploadRoute),
    OPTIONS: withCors(handleCorsOptions),
  },
};
