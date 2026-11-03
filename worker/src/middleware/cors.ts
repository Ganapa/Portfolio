import { HttpError, type RuntimeConfig } from "../types";

const ALLOWED_METHODS = "GET, POST, OPTIONS";
const ALLOWED_HEADERS = "Content-Type";

export function validateOrigin(
  request: Request,
  config: RuntimeConfig,
): string | null {
  const origin = request.headers.get("Origin");

  const requestUrl = new URL(request.url);
  const isLocalWorker =
    requestUrl.protocol === "http:" &&
    ["localhost", "127.0.0.1"].includes(requestUrl.hostname);
  let isApprovedLocalOrigin = false;
  if (origin && isLocalWorker) {
    try {
      const originUrl = new URL(origin);
      isApprovedLocalOrigin =
        originUrl.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(originUrl.hostname) &&
        !originUrl.username &&
        !originUrl.password;
    } catch {
      isApprovedLocalOrigin = false;
    }
  }

  if (
    origin &&
    !config.allowedOrigins.includes(origin) &&
    !isApprovedLocalOrigin
  ) {
    throw new HttpError(403, "ORIGIN_NOT_ALLOWED", "This origin is not allowed.");
  }

  return origin;
}

export function corsHeaders(origin: string | null): Headers {
  const headers = new Headers({
    "Vary": "Origin",
  });

  if (origin) {
    headers.set("Access-Control-Allow-Origin", origin);
  }

  return headers;
}

export function preflightResponse(request: Request, origin: string | null): Response {
  const requestedMethod = request.headers.get("Access-Control-Request-Method");

  if (requestedMethod && !["GET", "POST"].includes(requestedMethod)) {
    throw new HttpError(
      403,
      "CORS_REQUEST_NOT_ALLOWED",
      "This cross-origin request is not allowed.",
    );
  }

  const requestedHeaders = request.headers
    .get("Access-Control-Request-Headers")
    ?.split(",")
    .map((header) => header.trim().toLowerCase())
    .filter(Boolean);

  if (requestedHeaders?.some((header) => header !== "content-type")) {
    throw new HttpError(
      403,
      "CORS_REQUEST_NOT_ALLOWED",
      "This cross-origin request is not allowed.",
    );
  }

  const headers = corsHeaders(origin);
  headers.set("Access-Control-Allow-Methods", ALLOWED_METHODS);
  headers.set("Access-Control-Allow-Headers", ALLOWED_HEADERS);
  headers.set("Access-Control-Max-Age", "600");

  return new Response(null, { status: 204, headers });
}
