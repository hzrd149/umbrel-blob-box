/**
 * Blob descriptor as defined in BUD-02
 */
export interface BlobDescriptor {
  url: string;
  sha256: string;
  size: number;
  type: string;
  uploaded: number;
}

/**
 * Parsed blob path information
 */
export interface BlobPathInfo {
  hash: string;
  extension?: string;
}

/**
 * Range request information
 */
export interface RangeInfo {
  start: number;
  end: number;
}

/**
 * Authorization validation result
 */
export interface AuthResult {
  success: boolean;
  pubkey?: string;
  response?: Response;
}

/**
 * Early authorization validation result
 */
export interface EarlyAuthResult {
  success: boolean;
  pubkey?: string;
  event?: any; // NostrEvent type from utils/nostr.ts
  response?: Response;
}
