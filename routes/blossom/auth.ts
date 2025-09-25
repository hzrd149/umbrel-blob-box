import appConfig from "../../services/config.ts";
import {
  createAuthErrorResponse,
  isValidBlossomAuth,
  parseAuthorizationHeader,
  verifyEventSignature,
  type NostrEvent,
} from "../../utils/nostr.ts";
import type { AuthResult, EarlyAuthResult } from "./types.ts";

/**
 * Early validation of authorization (without hash validation)
 * This should be called before processing request body to prevent DoS attacks
 */
export async function validateAuthorizationEarly(
  req: Request,
  authType: "upload" | "list" | "delete",
): Promise<EarlyAuthResult> {
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
export function validateAuthorizationHash(
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
export async function validateAuthorization(
  req: Request,
  authType: "upload" | "list" | "delete",
  expectedHashes?: string[],
): Promise<AuthResult> {
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
