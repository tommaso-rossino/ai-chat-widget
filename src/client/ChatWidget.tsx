import { useEffect, useId, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent } from 'react';
import { useChat } from './useChat';

export interface ChatWidgetProps {
  /** URL that receives `POST { messages }` and answers with `{ reply }` JSON or an SSE stream. */
  endpoint: string;
  /** Extra headers sent with every request. Never put provider API keys here: they would be public. */
  headers?: Record<string, string>;
  /** Input placeholder. */
  placeholder?: string;
  /** Panel title. */
  title?: string;
  /** Message shown when the conversation is empty. Display-only: not sent to the backend. */
  welcomeMessage?: string;
  /** Called on network / HTTP / stream errors. */
  onError?: (error: Error) => void;
  /** Open the panel on mount. */
  defaultOpen?: boolean;
}

const ACCENT = '#2563eb';
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

const styles = {
  root: {
    position: 'fixed',
    right: 20,
    bottom: 20,
    zIndex: 2147483000,
    fontFamily: FONT,
    fontSize: 14,
    lineHeight: 1.45,
    color: '#111827',
    boxSizing: 'border-box',
  },
  toggle: {
    width: 56,
    height: 56,
    borderRadius: '50%',
    border: 'none',
    background: ACCENT,
    color: '#fff',
    cursor: 'pointer',
    boxShadow: '0 6px 20px rgba(0,0,0,0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 'auto',
    padding: 0,
  },
  panel: {
    width: 'min(370px, calc(100vw - 40px))',
    height: 'min(540px, calc(100vh - 110px))',
    marginBottom: 12,
    background: '#fff',
    borderRadius: 12,
    boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
    border: '1px solid #e5e7eb',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 14px',
    background: ACCENT,
    color: '#fff',
  },
  title: { margin: 0, fontSize: 15, fontWeight: 600 },
  close: {
    background: 'transparent',
    border: 'none',
    color: '#fff',
    cursor: 'pointer',
    fontSize: 20,
    lineHeight: 1,
    padding: 4,
  },
  list: {
    flex: 1,
    overflowY: 'auto',
    padding: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    background: '#f9fafb',
    margin: 0,
    listStyle: 'none',
  },
  bubble: {
    maxWidth: '85%',
    padding: '8px 12px',
    borderRadius: 12,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  user: { alignSelf: 'flex-end', background: ACCENT, color: '#fff', borderBottomRightRadius: 4 },
  assistant: { alignSelf: 'flex-start', background: '#fff', border: '1px solid #e5e7eb', borderBottomLeftRadius: 4 },
  status: { alignSelf: 'flex-start', color: '#6b7280', fontStyle: 'italic', padding: '0 4px' },
  error: {
    margin: '0 14px 8px',
    padding: '8px 10px',
    borderRadius: 8,
    background: '#fef2f2',
    color: '#b91c1c',
    fontSize: 13,
  },
  form: { display: 'flex', gap: 8, padding: 10, borderTop: '1px solid #e5e7eb', background: '#fff' },
  input: {
    flex: 1,
    resize: 'none',
    border: '1px solid #d1d5db',
    borderRadius: 8,
    padding: '8px 10px',
    font: 'inherit',
    color: 'inherit',
    background: '#fff',
    minHeight: 38,
    maxHeight: 120,
    boxSizing: 'border-box',
  },
  send: {
    border: 'none',
    borderRadius: 8,
    background: ACCENT,
    color: '#fff',
    padding: '0 14px',
    font: 'inherit',
    fontWeight: 600,
    cursor: 'pointer',
  },
  srOnly: {
    position: 'absolute',
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: 'hidden',
    clip: 'rect(0,0,0,0)',
    whiteSpace: 'nowrap',
    border: 0,
  },
} satisfies Record<string, CSSProperties>;

export function ChatWidget({
  endpoint,
  headers,
  placeholder = 'Type a message…',
  title = 'Chat',
  welcomeMessage,
  onError,
  defaultOpen = false,
}: ChatWidgetProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [input, setInput] = useState('');
  const { messages, loading, error, send } = useChat({ endpoint, headers, onError });

  const id = useId();
  const panelId = `${id}-panel`;
  const titleId = `${id}-title`;
  const inputId = `${id}-input`;

  const toggleRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading, open]);

  const close = () => {
    setOpen(false);
    toggleRef.current?.focus();
  };

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || loading) return;
    const text = input;
    setInput('');
    void send(text);
  };

  const onInputKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  const onPanelKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
    }
  };

  const last = messages[messages.length - 1];
  const waitingFirstToken = loading && last?.role !== 'assistant';
  const canSend = input.trim().length > 0 && !loading;

  return (
    <div style={styles.root} className="tr-chat-widget">
      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-labelledby={titleId}
          style={styles.panel}
          className="tr-chat-panel"
          onKeyDown={onPanelKeyDown}
        >
          <div style={styles.header} className="tr-chat-header">
            <h2 id={titleId} style={styles.title}>
              {title}
            </h2>
            <button type="button" onClick={close} aria-label="Close chat" style={styles.close} className="tr-chat-close">
              ×
            </button>
          </div>

          <ol ref={listRef} role="log" aria-live="polite" aria-relevant="additions text" aria-busy={loading} style={styles.list} className="tr-chat-list">
            {welcomeMessage && messages.length === 0 && (
              <li style={{ ...styles.bubble, ...styles.assistant }} className="tr-chat-msg tr-chat-msg-assistant">
                {welcomeMessage}
              </li>
            )}
            {messages.map((m, i) => (
              <li
                key={i}
                style={{ ...styles.bubble, ...(m.role === 'user' ? styles.user : styles.assistant) }}
                className={`tr-chat-msg tr-chat-msg-${m.role}`}
              >
                <span style={styles.srOnly}>{m.role === 'user' ? 'You: ' : 'Assistant: '}</span>
                {m.content}
              </li>
            ))}
            {waitingFirstToken && (
              <li style={styles.status} className="tr-chat-typing">
                Typing…
              </li>
            )}
          </ol>

          {error && (
            <div role="alert" style={styles.error} className="tr-chat-error">
              {error.message || 'Something went wrong.'}
            </div>
          )}

          <form onSubmit={submit} style={styles.form} className="tr-chat-form">
            <label htmlFor={inputId} style={styles.srOnly}>
              Message
            </label>
            <textarea
              id={inputId}
              ref={inputRef}
              rows={1}
              value={input}
              placeholder={placeholder}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onInputKeyDown}
              style={styles.input}
              className="tr-chat-input"
            />
            <button
              type="submit"
              disabled={!canSend}
              aria-label="Send message"
              style={{ ...styles.send, opacity: canSend ? 1 : 0.5, cursor: canSend ? 'pointer' : 'not-allowed' }}
              className="tr-chat-send"
            >
              Send
            </button>
          </form>
        </div>
      )}

      <button
        ref={toggleRef}
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-label={open ? 'Close chat' : 'Open chat'}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        style={styles.toggle}
        className="tr-chat-toggle"
      >
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
          </svg>
        )}
      </button>
    </div>
  );
}
