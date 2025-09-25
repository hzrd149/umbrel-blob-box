/**
 * HTTP Basic Authentication utility functions for consistent auth handling across all endpoints
 */

import type { BodyInit } from "bun";
import { addCorsHeaders } from "./cors.ts";
import { APP_PASSWORD, APP_USERNAME } from "../env";

/**
 * Authentication configuration
 */
export interface AuthConfig {
  username: string;
  password: string;
}

/**
 * Parse Basic Authentication header
 * Returns the decoded credentials or null if invalid
 */
export function parseBasicAuth(
  authHeader: string,
): { username: string; password: string } | null {
  if (!authHeader.startsWith("Basic ")) {
    return null;
  }

  try {
    const encoded = authHeader.slice(6); // Remove "Basic " prefix
    const decoded = atob(encoded);
    const colonIndex = decoded.indexOf(":");

    if (colonIndex === -1) {
      return null;
    }

    return {
      username: decoded.slice(0, colonIndex),
      password: decoded.slice(colonIndex + 1),
    };
  } catch {
    return null;
  }
}

/**
 * Validate credentials against expected username/password
 */
export function validateCredentials(
  credentials: { username: string; password: string },
  config: AuthConfig,
): boolean {
  return (
    credentials.username === config.username &&
    credentials.password === config.password
  );
}

/**
 * Create 401 Unauthorized response with WWW-Authenticate header
 */
export function createAuthRequiredResponse(
  realm: string = "Protected Area",
  additionalHeaders?: Record<string, string>,
): Response {
  return new Response("Unauthorized", {
    status: 401,
    headers: addCorsHeaders({
      "WWW-Authenticate": `Basic realm="${realm}"`,
      "X-Reason": "Authentication required",
      ...additionalHeaders,
    }),
  });
}

/**
 * Create 403 Forbidden response for invalid credentials
 */
export function createAuthForbiddenResponse(
  message: string = "Invalid credentials",
  additionalHeaders?: Record<string, string>,
): Response {
  return new Response(message, {
    status: 403,
    headers: addCorsHeaders({
      "X-Reason": message,
      ...additionalHeaders,
    }),
  });
}

/**
 * Create authenticated response with CORS headers
 */
export function createAuthResponse(
  body: BodyInit | null,
  options: {
    status?: number;
    headers?: Record<string, string>;
  } = {},
): Response {
  return new Response(body, {
    status: options.status || 200,
    headers: addCorsHeaders(options.headers || {}),
  });
}

/**
 * HTTP Basic Authentication middleware that can be applied to any request handler
 */
export function withAuth<T extends any[]>(
  config: AuthConfig,
  realm: string = "Protected Area",
) {
  return function (
    handler: (req: Request, ...args: T) => Promise<Response> | Response,
  ) {
    return async (req: Request, ...args: T): Promise<Response> => {
      // Get Authorization header
      const authHeader = req.headers.get("Authorization");

      if (!authHeader) {
        return createAuthRequiredResponse(realm);
      }

      // Parse credentials
      const credentials = parseBasicAuth(authHeader);
      if (!credentials) {
        return createAuthRequiredResponse(realm);
      }

      // Validate credentials
      if (!validateCredentials(credentials, config)) {
        return createAuthForbiddenResponse("Invalid credentials");
      }

      // Execute the handler with valid authentication
      const response = await handler(req, ...args);

      // Ensure CORS headers are present (they should be from the handler, but just in case)
      const headers = new Headers(response.headers);
      if (!headers.has("Access-Control-Allow-Origin")) {
        headers.set("Access-Control-Allow-Origin", "*");
      }

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    };
  };
}

/**
 * Simple auth middleware with environment variable support
 * Uses APP_PASSWORD from environment with configurable username
 */
export function withSimpleAuth() {
  const password = APP_PASSWORD;
  const username = APP_USERNAME;

  // Do nothing if no password is set
  if (!password) return (handler: (req: Request, ...args: any[]) => Promise<Response> | Response) => handler;

  return withAuth({ username, password }, "Admin dashboard");
}

/**
 * Check if a request has valid authentication without responding
 * Useful for conditional authentication
 */
export function isAuthenticated(req: Request, config: AuthConfig): boolean {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return false;

  const credentials = parseBasicAuth(authHeader);
  if (!credentials) return false;

  return validateCredentials(credentials, config);
}
