import { HttpError, type Env, type RuntimeConfig } from "../types";

const MODEL_PATTERN = /^[a-zA-Z0-9._-]{1,100}$/;

export function readRuntimeConfig(env: Env): RuntimeConfig {
  const model = env.GEMINI_MODEL?.trim();
  const configuredOrigins = env.ALLOWED_ORIGINS?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (!model || !MODEL_PATTERN.test(model)) {
    throw new HttpError(
      500,
      "SERVER_CONFIGURATION_ERROR",
      "The service is not configured correctly.",
    );
  }

  if (!configuredOrigins?.length) {
    throw new HttpError(
      500,
      "SERVER_CONFIGURATION_ERROR",
      "The service is not configured correctly.",
    );
  }

  const allowedOrigins = configuredOrigins.map((origin) => {
    let parsedOrigin: URL;

    try {
      parsedOrigin = new URL(origin);
    } catch {
      throw new HttpError(
        500,
        "SERVER_CONFIGURATION_ERROR",
        "The service is not configured correctly.",
      );
    }

    if (
      parsedOrigin.origin !== origin ||
      !["http:", "https:"].includes(parsedOrigin.protocol) ||
      origin === "*"
    ) {
      throw new HttpError(
        500,
        "SERVER_CONFIGURATION_ERROR",
        "The service is not configured correctly.",
      );
    }

    return origin;
  });

  return {
    geminiApiKey: env.GEMINI_API_KEY?.trim() || undefined,
    geminiModel: model,
    allowedOrigins: [...new Set(allowedOrigins)],
  };
}
