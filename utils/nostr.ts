/**
 * Nostr protocol utilities for Blossom authorization
 * Based on NIP-01 and BUD-02 specifications
 */

import { getEventHash, verifyEvent, type Event } from "nostr-tools";

/**
 * Nostr event structure (using nostr-tools Event type)
 */
export type NostrEvent = Event;

/**
 * Blossom authorization event types
 */
export type BlossomAuthType = "upload" | "list" | "delete";

/**
 * Verify a Nostr event signature and ID
 */
export function verifyEventSignature(event: NostrEvent): boolean {
  try {
    // Verify that the ID matches the event content
    const expectedId = getEventHash(event);
    if (event.id !== expectedId) {
      return false;
    }

    // Verify the signature using nostr-tools
    return verifyEvent(event);
  } catch (error) {
    console.error("Error verifying event signature:", error);
    return false;
  }
}

/**
 * Check if an event is a valid Blossom authorization event
 */
export function isValidBlossomAuth(
  event: NostrEvent,
  authType: BlossomAuthType,
  expectedHashes?: string[],
): boolean {
  // Check if it's the correct kind (24242 for Blossom auth)
  if (event.kind !== 24242) {
    return false;
  }

  // Check if it has the correct 't' tag
  const tTag = event.tags.find((tag) => tag[0] === "t");
  if (!tTag || tTag[1] !== authType) {
    return false;
  }

  // For upload and delete, check if it has the required 'x' tags with expected hashes
  if ((authType === "upload" || authType === "delete") && expectedHashes) {
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
    if (!hasMatchingHash) {
      return false;
    }
  }

  // Check expiration if present
  const expirationTag = event.tags.find((tag) => tag[0] === "expiration");
  if (expirationTag && expirationTag[1]) {
    const expiration = parseInt(expirationTag[1]);
    if (!isNaN(expiration) && Date.now() / 1000 > expiration) {
      return false; // Event has expired
    }
  }

  return true;
}

/**
 * Parse authorization header and extract Nostr event
 */
export function parseAuthorizationHeader(
  authHeader: string,
): NostrEvent | null {
  if (!authHeader.startsWith("Nostr ")) {
    return null;
  }

  try {
    const base64Event = authHeader.slice(6); // Remove "Nostr " prefix
    const eventJson = atob(base64Event);
    const event = JSON.parse(eventJson) as NostrEvent;

    // Basic validation
    if (
      !event.id ||
      !event.pubkey ||
      !event.created_at ||
      typeof event.kind !== "number" ||
      !Array.isArray(event.tags) ||
      typeof event.content !== "string" ||
      !event.sig
    ) {
      return null;
    }

    return event;
  } catch (error) {
    console.error("Error parsing authorization header:", error);
    return null;
  }
}

/**
 * Validate pubkey format (64-character hex string)
 */
export function isValidPubkey(pubkey: string): boolean {
  return /^[a-f0-9]{64}$/i.test(pubkey);
}

/**
 * Validate SHA256 hash format (64-character hex string)
 */
export function isValidSha256(hash: string): boolean {
  return /^[a-f0-9]{64}$/i.test(hash);
}

/**
 * Create a standardized error response for authorization failures
 */
export function createAuthErrorResponse(
  message: string,
  status: number = 401,
): Response {
  return new Response(message, {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "X-Reason": message,
    },
  });
}
