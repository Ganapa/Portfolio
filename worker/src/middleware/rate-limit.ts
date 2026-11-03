import { HttpError } from "../types";

const WINDOW_MS = 5 * 60_000;
const MAX_REQUESTS_PER_WINDOW = 30;
const MAX_TRACKED_CLIENTS = 10_000;
const requestsByClient = new Map<string, { startedAt: number; count: number }>();

export function enforceChatRateLimit(request: Request): void {
  const now = Date.now();
  const clientId = request.headers.get("CF-Connecting-IP") ?? "unknown-client";
  const current = requestsByClient.get(clientId);

  if (!current || now - current.startedAt >= WINDOW_MS) {
    if (requestsByClient.size >= MAX_TRACKED_CLIENTS) {
      for (const [key, entry] of requestsByClient) {
        if (now - entry.startedAt >= WINDOW_MS) requestsByClient.delete(key);
      }

      if (requestsByClient.size >= MAX_TRACKED_CLIENTS) {
        requestsByClient.clear();
      }
    }

    requestsByClient.set(clientId, { startedAt: now, count: 1 });
    return;
  }

  if (current.count >= MAX_REQUESTS_PER_WINDOW) {
    throw new HttpError(
      429,
      "RATE_LIMITED",
      "Too many requests. Please wait a few minutes and try again.",
    );
  }

  current.count += 1;
}
