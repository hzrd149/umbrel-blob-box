/**
 * CORS utility functions for consistent cross-origin handling across all endpoints
 */

import type { BodyInit } from "bun";

/**
 * Standard CORS headers for all responses
 */
export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
} as const;

/**
 * CORS headers for preflight requests
 */
export const PREFLIGHT_HEADERS = {
  ...CORS_HEADERS,
  "Access-Control-Allow-Headers": "Authorization, *",
  "Access-Control-Allow-Methods": "GET, HEAD, PUT, DELETE, POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
} as const;

/**
 * Handle CORS preflight requests (OPTIONS method)
 */
export function handleCorsPreflightRequest(): Response {
  return new Response(null, {
    status: 200,
    headers: PREFLIGHT_HEADERS,
  });
}

/**
 * Add CORS headers to any response
 */
export function addCorsHeaders(
  headers: Record<string, string>,
): Record<string, string> {
  return {
    ...CORS_HEADERS,
    ...headers,
  };
}

/**
 * Create error response with CORS headers
 */
export function createCorsErrorResponse(
  message: string,
  status: number,
  reason?: string,
  additionalHeaders?: Record<string, string>,
): Response {
  return new Response(message, {
    status,
    headers: addCorsHeaders({
      "X-Reason": reason || message,
      ...additionalHeaders,
    }),
  });
}

/**
 * Create success response with CORS headers
 */
export function createCorsResponse(
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
 * CORS middleware that can be applied to any request handler
 */
export function withCors<T extends any[]>(
  handler: (req: Request, ...args: T) => Promise<Response> | Response,
) {
  return async (req: Request, ...args: T): Promise<Response> => {
    // Handle preflight requests
    if (req.method === "OPTIONS") return handleCorsPreflightRequest();

    // Execute the handler and ensure CORS headers are added
    const response = await handler(req, ...args);

    // Add CORS headers to the response if not already present
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
}
