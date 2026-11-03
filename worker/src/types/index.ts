export interface Env {
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  ALLOWED_ORIGINS?: string;
}

export interface RuntimeConfig {
  geminiApiKey: string | undefined;
  geminiModel: string;
  allowedOrigins: string[];
}

export interface ChatRequest {
  message: string;
  history?: ConversationTurn[];
}

export interface ConversationTurn {
  role: "user" | "assistant";
  text: string;
}

export interface SuccessResponse {
  success: true;
  reply: string;
  actions: {
    displayProjects: PortfolioProjectSummary[];
    navigationProjectId: string | null;
  };
}

export interface PortfolioProjectSummary {
  id: string;
  name: string;
  classification: string | null;
  summary: string;
}

export interface PortfolioKnowledgeContext {
  context: string;
  displayProjects: PortfolioProjectSummary[];
  navigationProjectId: string | null;
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export class GeminiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly upstreamStatus?: number,
  ) {
    super(message);
    this.name = "GeminiError";
  }
}
