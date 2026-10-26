import type { ChatMessage } from '../types';

export type ChatProvider = 'anthropic' | 'openai';

export interface CreateChatHandlerOptions {
  provider: ChatProvider;
  /** Provider API key. Read it from an env var on the server, never ship it to the browser. */
  apiKey: string;
  /** Defaults: `claude-sonnet-4-5` (anthropic), `gpt-4o-mini` (openai). */
  model?: string;
  systemPrompt?: string;
  /** Max tokens for the reply. Default: 1024. */
  maxTokens?: number;
  /** Respond with an SSE stream (`text/event-stream`) instead of JSON. Default: false. */
  stream?: boolean;
  /** Max messages accepted per request (oldest are rejected beyond this). Default: 50. */
  maxMessages?: number;
  /** Max characters per message. Default: 8000. */
  maxMessageLength?: number;
  /** Server-side hook for logging upstream / internal errors. The client only ever sees a generic message. */
  onError?: (error: unknown) => void;
}

export type ChatHandler = (req: Request) => Promise<Response>;

export const DEFAULT_MODELS: Record<ChatProvider, string> = {
  anthropic: 'claude-sonnet-4-5',
  openai: 'gpt-4o-mini',
};

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

const GENERIC_ERROR = 'Something went wrong. Please try again.';

class UpstreamError extends Error {
  constructor(
    readonly provider: ChatProvider,
    readonly status: number,
    readonly body: string,
  ) {
    super(`${provider} API responded with status ${status}`);
    this.name = 'UpstreamError';
  }
}

export function createChatHandler(options: CreateChatHandlerOptions): ChatHandler {
  const {
    provider,
    apiKey,
    model = DEFAULT_MODELS[provider],
    systemPrompt,
    maxTokens = 1024,
    stream = false,
    maxMessages = 50,
    maxMessageLength = 8000,
    onError,
  } = options;

  if (provider !== 'anthropic' && provider !== 'openai') {
    throw new Error(`Unsupported provider: ${String(provider)}`);
  }

  return async function chatHandler(req: Request): Promise<Response> {
    if (req.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405, { Allow: 'POST' });
    }

    if (!apiKey) {
      return json({ error: 'Chat backend is not configured' }, 401);
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }

    const parsed = parseMessages(body, maxMessages, maxMessageLength);
    if (typeof parsed === 'string') return json({ error: parsed }, 400);

    try {
      const upstream = await callProvider({ provider, apiKey, model, systemPrompt, maxTokens, stream, messages: parsed, signal: req.signal });

      if (!stream) {
        const data: unknown = await upstream.json();
        return json({ reply: extractReply(provider, data) }, 200);
      }

      if (!upstream.body) throw new Error('Upstream returned an empty stream');
      return new Response(toClientSSE(provider, upstream.body, onError), {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no',
        },
      });
    } catch (err) {
      onError?.(err);
      return json({ error: GENERIC_ERROR }, 500);
    }
  };
}

function json(data: unknown, status: number, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });
}

/** Returns the validated messages, or an error string. Only `user`/`assistant` roles are accepted: the system prompt is server-controlled. */
function parseMessages(body: unknown, maxMessages: number, maxLength: number): ChatMessage[] | string {
  if (!body || typeof body !== 'object' || !Array.isArray((body as { messages?: unknown }).messages)) {
    return 'Body must be { messages: Array<{ role, content }> }';
  }
  const raw = (body as { messages: unknown[] }).messages;
  if (raw.length === 0) return 'messages must not be empty';
  if (raw.length > maxMessages) return `Too many messages (max ${maxMessages})`;

  const messages: ChatMessage[] = [];
  for (const m of raw) {
    if (!m || typeof m !== 'object') return 'Each message must be an object';
    const { role, content } = m as { role?: unknown; content?: unknown };
    if (role !== 'user' && role !== 'assistant') return 'Message role must be "user" or "assistant"';
    if (typeof content !== 'string' || !content.trim()) return 'Message content must be a non-empty string';
    if (content.length > maxLength) return `Message too long (max ${maxLength} characters)`;
    messages.push({ role, content });
  }
  if (messages[0]?.role !== 'user') return 'The first message must be from the user';
  if (messages[messages.length - 1]?.role !== 'user') return 'The last message must be from the user';
  return messages;
}

interface ProviderCall {
  provider: ChatProvider;
  apiKey: string;
  model: string;
  systemPrompt?: string;
  maxTokens: number;
  stream: boolean;
  messages: ChatMessage[];
  signal?: AbortSignal;
}

async function callProvider({ provider, apiKey, model, systemPrompt, maxTokens, stream, messages, signal }: ProviderCall): Promise<Response> {
  let res: Response;
  if (provider === 'anthropic') {
    res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages,
        ...(systemPrompt ? { system: systemPrompt } : {}),
        ...(stream ? { stream: true } : {}),
      }),
      signal,
    });
  } else {
    res = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_completion_tokens: maxTokens,
        messages: systemPrompt ? [{ role: 'system', content: systemPrompt }, ...messages] : messages,
        ...(stream ? { stream: true } : {}),
      }),
      signal,
    });
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new UpstreamError(provider, res.status, text.slice(0, 2000));
  }
  return res;
}

function extractReply(provider: ChatProvider, data: unknown): string {
  if (provider === 'anthropic') {
    const content = (data as { content?: Array<{ type?: string; text?: string }> })?.content;
    if (!Array.isArray(content)) throw new Error('Unexpected Anthropic response shape');
    return content
      .filter((b) => b.type === 'text' && typeof b.text === 'string')
      .map((b) => b.text)
      .join('');
  }
  const text = (data as { choices?: Array<{ message?: { content?: unknown } }> })?.choices?.[0]?.message?.content;
  if (typeof text !== 'string') throw new Error('Unexpected OpenAI response shape');
  return text;
}

/** Extracts a text delta from one upstream SSE event. Returns `null` for non-text events. */
function extractDelta(provider: ChatProvider, event: string, data: string): { delta?: string; done?: boolean; error?: string } | null {
  if (provider === 'openai') {
    if (data === '[DONE]') return { done: true };
    const parsed = safeParse(data) as { choices?: Array<{ delta?: { content?: unknown } }>; error?: unknown } | undefined;
    if (parsed?.error) return { error: 'upstream error' };
    const content = parsed?.choices?.[0]?.delta?.content;
    return typeof content === 'string' && content ? { delta: content } : null;
  }

  const parsed = safeParse(data) as { type?: string; delta?: { type?: string; text?: unknown } } | undefined;
  const type = parsed?.type ?? event;
  if (type === 'message_stop') return { done: true };
  if (type === 'error') return { error: 'upstream error' };
  if (type === 'content_block_delta' && parsed?.delta?.type === 'text_delta' && typeof parsed.delta.text === 'string') {
    return { delta: parsed.delta.text };
  }
  return null;
}

/** Re-encodes the provider stream as the widget's SSE protocol: `data: {"delta"}` … `data: [DONE]`. */
function toClientSSE(provider: ChatProvider, upstream: ReadableStream<Uint8Array>, onError?: (error: unknown) => void): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader = upstream.getReader();
  let buffer = '';
  let finished = false;

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const send = (payload: string, event?: string) =>
        controller.enqueue(encoder.encode(`${event ? `event: ${event}\n` : ''}data: ${payload}\n\n`));
      const finish = () => {
        if (finished) return;
        finished = true;
        send('[DONE]');
        controller.close();
        reader.cancel().catch(() => {});
      };

      try {
        const { done, value } = await reader.read();
        if (done) {
          buffer += decoder.decode();
          if (buffer.trim()) processBlock(buffer);
          finish();
          return;
        }
        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split(/\r?\n\r?\n/);
        buffer = blocks.pop() ?? '';
        for (const block of blocks) {
          processBlock(block);
          if (finished) return;
        }
      } catch (err) {
        if (finished) return;
        onError?.(err);
        send(JSON.stringify({ error: GENERIC_ERROR }), 'error');
        finish();
      }

      function processBlock(block: string) {
        let event = '';
        const dataLines: string[] = [];
        for (const line of block.split(/\r?\n/)) {
          if (line.startsWith('event:')) event = line.slice(6).trim();
          else if (line.startsWith('data:')) dataLines.push(line.slice(5).replace(/^ /, ''));
        }
        if (dataLines.length === 0) return;
        const result = extractDelta(provider, event, dataLines.join('\n'));
        if (!result) return;
        if (result.error) {
          onError?.(new Error(`${provider} stream error: ${dataLines.join('\n').slice(0, 2000)}`));
          send(JSON.stringify({ error: GENERIC_ERROR }), 'error');
          finish();
        } else if (result.delta) {
          send(JSON.stringify({ delta: result.delta }));
        } else if (result.done) {
          finish();
        }
      }
    },
    cancel(reason) {
      finished = true;
      return reader.cancel(reason);
    },
  });
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
