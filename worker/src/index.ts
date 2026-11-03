import { readRuntimeConfig } from "./config/environment";
import { corsHeaders, preflightResponse, validateOrigin } from "./middleware/cors";
import { enforceChatRateLimit } from "./middleware/rate-limit";
import { handleChat } from "./routes/chat";
import { handleHealth } from "./routes/health";
import {
  GeminiError,
  HttpError,
  type Env,
  type ErrorResponse,
} from "./types";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    let config;

    try {
      config = readRuntimeConfig(env);
    } catch (error) {
      return errorResponse(error);
    }

    let origin: string | null;

    try {
      origin = validateOrigin(request, config);
    } catch (error) {
      return errorResponse(error);
    }

    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      try {
        return preflightResponse(request, origin);
      } catch (error) {
        const response = errorResponse(error);
        const headers = new Headers(response.headers);
        corsHeaders(origin).forEach((value, key) => headers.set(key, value));
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      }
    }

    let response: Response;

    try {
      if (url.pathname === "/api/health") {
        if (request.method !== "GET") {
          throw new HttpError(
            405,
            "METHOD_NOT_ALLOWED",
            "Use GET for this endpoint.",
          );
        }

        response = handleHealth();
      } else if (url.pathname === "/api/chat") {
        if (request.method === "POST") {
          enforceChatRateLimit(request);
        }
        response = await handleChat(request, config);
      } else {
        throw new HttpError(404, "NOT_FOUND", "The requested endpoint was not found.");
      }
    } catch (error) {
      response = errorResponse(error);
    }

    const headers = new Headers(response.headers);
    const cors = corsHeaders(origin);
    cors.forEach((value, key) => headers.set(key, value));

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};

function errorResponse(error: unknown): Response {
  let status = 500;
  let code = "INTERNAL_SERVER_ERROR";
  let message = "The request could not be completed.";

  if (error instanceof HttpError || error instanceof GeminiError) {
    status = error.status;
    code = error.code;
    message = error.message;
  }

  const body: ErrorResponse = {
    success: false,
    error: { code, message },
  };

  return Response.json(body, { status });
}
