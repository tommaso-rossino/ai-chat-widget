import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { useChat } from './useChat';

/** `CSSProperties` that also accepts CSS custom properties, e.g. `{ '--cw-accent': '#c8553d' }`. */
export type ChatWidgetStyle = CSSProperties & { [key: `--${string}`]: string | number | undefined };

export type ChatWidgetVariant = 'light' | 'dark';

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
  /** Built-in palette used when a `--cw-*` property is not set. */
  variant?: ChatWidgetVariant;
  /** Extra class on the root element. Set `--cw-*` properties on it to theme the widget. */
  className?: string;
  /** Inline styles merged onto the root element. Accepts `--cw-*` properties. */
  style?: ChatWidgetStyle;
  /** Custom launcher icon, shown while the panel is closed. */
  toggleIcon?: ReactNode;
}

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

/** Fallback values for every `--cw-*` property. A property set by the consumer always wins. */
const LIGHT = {
  font: FONT,
  text: '#111827',
  muted: '#6b7280',
  'panel-bg': '#ffffff',
  'list-bg': '#f9fafb',
  border: '#e5e7eb',
  accent: '#2563eb',
  'accent-contrast': '#ffffff',
  'bubble-bg': '#ffffff',
  'bubble-text': '#111827',
  'input-bg': '#ffffff',
  'input-border': '#d1d5db',
  'error-bg': '#fef2f2',
  'error-text': '#b91c1c',
  shadow: '0 12px 40px rgba(0,0,0,0.18)',
  'toggle-shadow': '0 6px 20px rgba(0,0,0,0.2)',
  radius: '12px',
  'radius-sm': '8px',
};

type Theme = typeof LIGHT;

const DARK: Theme = {
  ...LIGHT,
  text: '#e5e0db',
  muted: '#8a8580',
  'panel-bg': '#0c0c0c',
  'list-bg': '#0a0a0a',
  border: 'rgba(255,255,255,0.08)',
  'bubble-bg': 'rgba(255,255,255,0.04)',
  'bubble-text': '#e5e0db',
  'input-bg': 'rgba(255,255,255,0.03)',
  'input-border': 'rgba(255,255,255,0.08)',
  'error-bg': 'rgba(185,28,28,0.15)',
  'error-text': '#fca5a5',
};

function createStyles(theme: Theme) {
  const v = (name: keyof Theme) => `var(--cw-${name}, ${theme[name]})`;
  const accent = v('accent');
  const accentContrast = v('accent-contrast');
  const border = `1px solid ${v('border')}`;

  return {
    root: {
      position: 'fixed',
      zIndex: 2147483000,
      fontFamily: v('font'),
      fontSize: 14,
      lineHeight: 1.45,
      color: v('text'),
      boxSizing: 'border-box',
    },
    toggle: {
      width: 56,
      height: 56,
      borderRadius: '50%',
      border: 'none',
      background: accent,
      color: accentContrast,
      cursor: 'pointer',
      boxShadow: v('toggle-shadow'),
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 'auto',
      padding: 0,
    },
    panel: {
      marginBottom: 12,
      background: v('panel-bg'),
      borderRadius: v('radius'),
      boxShadow: v('shadow'),
      border,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 14px',
      background: `var(--cw-header-bg, ${accent})`,
      color: `var(--cw-header-text, ${accentContrast})`,
      borderBottom: 'var(--cw-header-border, none)',
    },
    title: { margin: 0, fontSize: 15, fontWeight: 600, fontFamily: 'var(--cw-title-font, inherit)' },
    close: {
      background: 'transparent',
      border: 'none',
      color: 'inherit',
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
      background: v('list-bg'),
      margin: 0,
      listStyle: 'none',
    },
    bubble: {
      maxWidth: '85%',
      padding: '8px 12px',
      borderRadius: v('radius'),
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
    },
    user: { alignSelf: 'flex-end', background: accent, color: accentContrast, borderBottomRightRadius: 4 },
    assistant: {
      alignSelf: 'flex-start',
      background: v('bubble-bg'),
      color: v('bubble-text'),
      border,
      borderBottomLeftRadius: 4,
    },
    status: { alignSelf: 'flex-start', color: v('muted'), fontStyle: 'italic', padding: '0 4px' },
    error: {
      margin: '0 14px 8px',
      padding: '8px 10px',
      borderRadius: v('radius-sm'),
      background: v('error-bg'),
      color: v('error-text'),
      fontSize: 13,
    },
    form: { display: 'flex', gap: 8, padding: 10, borderTop: border, background: v('panel-bg') },
    input: {
      flex: 1,
      resize: 'none',
      border: `1px solid ${v('input-border')}`,
      borderRadius: v('radius-sm'),
      padding: '8px 10px',
      color: 'inherit',
      background: v('input-bg'),
      minHeight: 38,
      maxHeight: 120,
      boxSizing: 'border-box',
      touchAction: 'manipulation',
    },
    send: {
      border: 'none',
      borderRadius: v('radius-sm'),
      background: accent,
      color: accentContrast,
      padding: '0 14px',
      font: 'inherit',
      fontWeight: 600,
      cursor: 'pointer',
      touchAction: 'manipulation',
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
}

/**
 * Rules inline styles can't express: media queries and the `dvh` -> `vh` fallback.
 * Inputs render at 16px on small screens so iOS/Android don't auto-zoom on focus.
 * Panel size is static (never derived from focus or keyboard state) and always fits the viewport.
 */
const CSS = `
.tr-chat-widget {
  right: 20px;
  bottom: 20px;
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
}
.tr-chat-panel {
  width: min(380px, calc(100vw - 24px));
  max-width: calc(100vw - 24px);
  height: 560px;
  max-height: min(560px, calc(100vh - 90px));
  max-height: min(560px, calc(100dvh - 90px));
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
}
.tr-chat-panel,
.tr-chat-panel * {
  box-sizing: border-box;
}
.tr-chat-input {
  font: inherit;
}
@media (max-width: 480px) {
  .tr-chat-widget {
    right: 12px;
    bottom: 12px;
  }
  .tr-chat-widget .tr-chat-input {
    font-size: 16px;
  }
}
`;

const STYLES: Record<ChatWidgetVariant, ReturnType<typeof createStyles>> = {
  light: createStyles(LIGHT),
  dark: createStyles(DARK),
};

export function ChatWidget({
  endpoint,
  headers,
  placeholder = 'Ask me anything…',
  title = 'Chat with me',
  welcomeMessage,
  onError,
  defaultOpen = false,
  variant = 'light',
  className,
  style,
  toggleIcon,
}: ChatWidgetProps) {
  const styles = STYLES[variant] ?? STYLES.light;
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
    <div style={{ ...styles.root, ...style }} className={className ? `tr-chat-widget ${className}` : 'tr-chat-widget'}>
      <style>{CSS}</style>
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
        ) : toggleIcon !== undefined ? (
          toggleIcon
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
          </svg>
        )}
      </button>
    </div>
  );
}
