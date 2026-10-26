export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

/** Body sent by the client to the endpoint. */
export interface ChatRequestBody {
  messages: ChatMessage[];
}

/** Non-streaming JSON response expected from the endpoint. */
export interface ChatResponseBody {
  reply: string;
}

/**
 * One SSE event payload (`data: <json>`) for streaming responses.
 * The stream ends with `data: [DONE]`. Errors are sent as `event: error` + `data: {"error": "..."}`.
 */
export interface ChatStreamChunk {
  delta: string;
}
