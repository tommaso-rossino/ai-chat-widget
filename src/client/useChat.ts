import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '../types';

export interface UseChatOptions {
  /** URL that receives `POST { messages }` and answers with `{ reply }` JSON or an SSE stream. */
  endpoint: string;
  /** Extra headers sent with every request (e.g. a session token). Never put provider API keys here. */
  headers?: Record<string, string>;
  /** Initial conversation history. */
  initialMessages?: ChatMessage[];
  /** Called on network / HTTP / stream errors. */
  onError?: (error: Error) => void;
}

export interface UseChatResult {
  messages: ChatMessage[];
  loading: boolean;
  error: Error | null;
  /** Sends a user message and appends the assistant reply. Resolves when the reply is complete. */
  send: (message: string) => Promise<void>;
  /** Aborts the in-flight request, if any. */
  stop: () => void;
  /** Clears the conversation and the error. */
  reset: () => void;
}

export function useChat({ endpoint, headers, initialMessages, onError }: UseChatOptions): UseChatResult {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Refs keep `send` stable and always reading the latest values.
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const headersRef = useRef(headers);
  headersRef.current = headers;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
  }, []);

  const reset = useCallback(() => {
    stop();
    setMessages([]);
    setError(null);
  }, [stop]);

  const send = useCallback(
    async (message: string) => {
      const content = message.trim();
      if (!content || abortRef.current) return;

      // Drop empty turns (e.g. a reply that failed before its first token): backends reject them.
      const history: ChatMessage[] = [...messagesRef.current.filter((m) => m.content.trim()), { role: 'user', content }];
      setMessages(history);
      setLoading(true);
      setError(null);

      const controller = new AbortController();
      abortRef.current = controller;

      // Appends text to the assistant message at `history.length`, creating it on first call.
      const appendToReply = (text: string) => {
        setMessages((prev) => {
          const next = prev.slice();
          const current = next[history.length];
          next[history.length] = { role: 'assistant', content: (current?.content ?? '') + text };
          return next;
        });
      };

      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...headersRef.current },
          body: JSON.stringify({ messages: history }),
          signal: controller.signal,
        });

        if (!res.ok) throw new Error(await readErrorMessage(res));

        const contentType = res.headers.get('content-type') ?? '';
        if (contentType.includes('text/event-stream')) {
          if (!res.body) throw new Error('Empty response stream');
          await readSSE(res.body, appendToReply);
        } else {
          const data: unknown = await res.json();
          const reply = data && typeof data === 'object' ? (data as { reply?: unknown }).reply : undefined;
          if (typeof reply !== 'string') throw new Error('Invalid response: expected { reply: string }');
          if (reply) appendToReply(reply);
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e);
        onErrorRef.current?.(e);
      } finally {
        // Skip if `stop()` or a newer request already took over.
        if (abortRef.current === controller) {
          abortRef.current = null;
          setLoading(false);
        }
      }
    },
    [endpoint],
  );

  return { messages, loading, error, send, stop, reset };
}

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const data: unknown = await res.json();
    const msg = data && typeof data === 'object' ? (data as { error?: unknown }).error : undefined;
    if (typeof msg === 'string' && msg) return msg;
  } catch {
    // not JSON
  }
  return `Request failed with status ${res.status}`;
}

/** Minimal SSE reader. Accepts `data: {"delta": "..."}` (also `text`/`content`) or raw text; stops at `[DONE]`. */
async function readSSE(body: ReadableStream<Uint8Array>, onDelta: (text: string) => void): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const handleEvent = (raw: string): boolean => {
    let event = 'message';
    const dataLines: string[] = [];
    for (const line of raw.split(/\r?\n/)) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).replace(/^ /, ''));
    }
    if (dataLines.length === 0) return false;
    const data = dataLines.join('\n');
    if (data === '[DONE]') return true;

    let parsed: unknown = data;
    try {
      parsed = JSON.parse(data);
    } catch {
      // raw text chunk
    }

    if (event === 'error') {
      const msg = parsed && typeof parsed === 'object' ? (parsed as { error?: unknown }).error : parsed;
      throw new Error(typeof msg === 'string' && msg ? msg : 'Stream error');
    }

    if (typeof parsed === 'string') onDelta(parsed);
    else if (parsed && typeof parsed === 'object') {
      const p = parsed as { delta?: unknown; text?: unknown; content?: unknown };
      const text = p.delta ?? p.text ?? p.content;
      if (typeof text === 'string') onDelta(text);
    }
    return false;
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() ?? '';
      for (const evt of events) {
        if (handleEvent(evt)) return;
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) handleEvent(buffer);
  } finally {
    reader.cancel().catch(() => {});
  }
}
