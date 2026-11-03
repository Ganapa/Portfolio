import { generateReply } from "../services/gemini";
import {
  GeminiError,
  HttpError,
  type ChatRequest,
  type ConversationTurn,
  type RuntimeConfig,
  type SuccessResponse,
} from "../types";

const MAX_BODY_BYTES = 8 * 1024;
const MAX_MESSAGE_LENGTH = 2_000;
const MAX_HISTORY_MESSAGES = 8;
const MAX_HISTORY_MESSAGE_LENGTH = 1_200;

export async function handleChat(
  request: Request,
  config: RuntimeConfig,
): Promise<Response> {
  if (request.method !== "POST") {
    throw new HttpError(405, "METHOD_NOT_ALLOWED", "Use POST for this endpoint.");
  }

  const contentType = request.headers.get("Content-Type")?.split(";", 1)[0].trim();

  if (contentType?.toLowerCase() !== "application/json") {
    throw new HttpError(
      415,
      "UNSUPPORTED_MEDIA_TYPE",
      "Send the request as application/json.",
    );
  }

  const chatRequest = await readChatRequest(request);

  let response: SuccessResponse;

  try {
    response = await generateReply(config, chatRequest);
  } catch (error) {
    if (error instanceof GeminiError) {
      throw error;
    }

    throw new HttpError(
      500,
      "INTERNAL_SERVER_ERROR",
      "The request could not be completed.",
    );
  }

  return Response.json(response);
}

async function readChatRequest(request: Request): Promise<ChatRequest> {
  const contentLength = request.headers.get("Content-Length");

  if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
    throw new HttpError(413, "REQUEST_TOO_LARGE", "The request is too large.");
  }

  if (!request.body) {
    throw new HttpError(400, "INVALID_JSON", "Send a valid JSON request body.");
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      totalBytes += value.byteLength;

      if (totalBytes > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new HttpError(413, "REQUEST_TOO_LARGE", "The request is too large.");
      }

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bodyBytes = new Uint8Array(totalBytes);
  let offset = 0;

  for (const chunk of chunks) {
    bodyBytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  let payload: unknown;

  try {
    const body = new TextDecoder("utf-8", { fatal: true }).decode(bodyBytes);
    payload = JSON.parse(body);
  } catch {
    throw new HttpError(400, "INVALID_JSON", "Send a valid JSON request body.");
  }

  if (
    typeof payload !== "object" ||
    payload === null ||
    Array.isArray(payload)
  ) {
    throw new HttpError(400, "INVALID_REQUEST", "The request body must be an object.");
  }

  const keys = Object.keys(payload);

  if (keys.some((key) => key !== "message" && key !== "history")) {
    throw new HttpError(
      400,
      "UNSUPPORTED_FIELDS",
      "Only the message and optional history fields are supported.",
    );
  }

  const record = payload as Record<string, unknown>;
  const candidate = record.message;

  if (typeof candidate !== "string") {
    throw new HttpError(400, "MESSAGE_REQUIRED", "A message is required.");
  }

  const message = candidate.trim();

  if (!message) {
    throw new HttpError(400, "MESSAGE_REQUIRED", "A message is required.");
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    throw new HttpError(
      413,
      "MESSAGE_TOO_LONG",
      `The message must be ${MAX_MESSAGE_LENGTH} characters or fewer.`,
    );
  }

  const history = record.history;

  if (history === undefined) {
    return { message };
  }

  if (!Array.isArray(history) || history.length > MAX_HISTORY_MESSAGES) {
    throw new HttpError(
      400,
      "INVALID_HISTORY",
      `Conversation history must contain no more than ${MAX_HISTORY_MESSAGES} messages.`,
    );
  }

  const validatedHistory = history.map((turn): ConversationTurn => {
    if (
      typeof turn !== "object" ||
      turn === null ||
      Array.isArray(turn) ||
      Object.keys(turn).some((key) => key !== "role" && key !== "text")
    ) {
      throw new HttpError(400, "INVALID_HISTORY", "Conversation history is invalid.");
    }

    const candidateTurn = turn as Record<string, unknown>;
    const role = candidateTurn.role;
    const text = candidateTurn.text;

    if (
      (role !== "user" && role !== "assistant") ||
      typeof text !== "string" ||
      !text.trim() ||
      text.length > MAX_HISTORY_MESSAGE_LENGTH
    ) {
      throw new HttpError(400, "INVALID_HISTORY", "Conversation history is invalid.");
    }

    return { role, text: text.trim() };
  });

  return { message, history: validatedHistory };
}
