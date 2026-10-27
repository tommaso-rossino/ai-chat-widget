# @trossino/chat-widget

Batteries-included React chat widget, plus an optional framework-agnostic server handler for Anthropic and OpenAI.

- Drop-in UI: floating bottom-right panel, fully styled inline (no Tailwind, no CSS file required).
- Zero runtime dependencies: native `fetch`, Web `Request`/`Response`.
- JSON or SSE streaming responses, detected automatically from `Content-Type`.
- Works with Next.js App Router, Vercel, Cloudflare Workers, Deno, Bun, or any Web-standard runtime.
- Accessible: labelled controls, `role="log"` live region, Enter to send, Shift+Enter for newline, Esc to close.

## Install

```bash
npm i @trossino/chat-widget
```

Peer dependencies: `react` and `react-dom` 18 or 19.

## Client only (your own endpoint)

```tsx
import { ChatWidget } from '@trossino/chat-widget';

export default function App() {
  return <ChatWidget endpoint="/api/my-chat" title="Support" welcomeMessage="Hi! How can I help?" />;
}
```

Your endpoint receives `POST { messages: Array<{ role: 'user' | 'assistant', content: string }> }` and must answer with either:

- JSON: `{ "reply": "..." }`
- SSE (`Content-Type: text/event-stream`): `data: {"delta":"..."}` events, ending with `data: [DONE]`. Errors: `event: error` + `data: {"error":"..."}`.

Want your own UI? Use the hook directly:

```tsx
import { useChat } from '@trossino/chat-widget';

const { messages, loading, error, send, stop, reset } = useChat({ endpoint: '/api/chat' });
```

## Batteries included (Next.js App Router)

`app/api/chat/route.ts`:

```ts
import { createChatHandler } from '@trossino/chat-widget/server';

export const POST = createChatHandler({
  provider: 'anthropic', // or 'openai'
  apiKey: process.env.ANTHROPIC_API_KEY ?? '',
  systemPrompt: 'You are a concise, friendly assistant.',
  maxTokens: 1024,
  stream: true,
});
```

`app/page.tsx`:

```tsx
import { ChatWidget } from '@trossino/chat-widget';

export default function Page() {
  return <ChatWidget endpoint="/api/chat" />;
}
```

The client bundle ships with `"use client"`, so it can be rendered from Server Components. See [`examples/nextjs`](./examples/nextjs) for a full app.

The handler is a plain `(req: Request) => Promise<Response>`, so it also works as a Cloudflare Worker (`export default { fetch: handler }`) or with `Deno.serve(handler)`.

## `<ChatWidget>` props

| Prop             | Type                     | Default              | Description                                                              |
| ---------------- | ------------------------ | -------------------- | ------------------------------------------------------------------------ |
| `endpoint`       | `string`                 | —                    | URL receiving `POST { messages }`. Required.                             |
| `headers`        | `Record<string, string>` | —                    | Extra request headers (e.g. a session token). **Never a provider key.**  |
| `placeholder`    | `string`                 | `"Ask me anything…"` | Input placeholder.                                                       |
| `title`          | `string`                 | `"Chat with me"`     | Panel title.                                                             |
| `welcomeMessage` | `string`                 | —                    | Shown when the conversation is empty. Display-only, not sent to the API. |
| `onError`        | `(error: Error) => void` | —                    | Called on network, HTTP, or stream errors.                               |
| `defaultOpen`    | `boolean`                | `false`              | Open the panel on mount.                                                 |
| `variant`        | `'light' \| 'dark'`      | `'light'`            | Built-in palette. See [Theming](#theming).                               |
| `className`      | `string`                 | —                    | Extra class on the root element (it always has `tr-chat-widget`).        |
| `style`          | `ChatWidgetStyle`        | —                    | Inline styles merged onto the root. Accepts `--cw-*` properties.         |
| `toggleIcon`     | `ReactNode`              | chat bubble icon     | Custom launcher icon, shown while the panel is closed.                   |

## Theming

Every color, radius, shadow, and font is read from a CSS custom property on the root element, with a built-in fallback. Set the properties from a class (via `className`) or inline (via `style`) and the widget picks them up. Anything you set wins over `variant`; anything you don't set falls back to the variant's value.

| Property                | Light default                                                       | Dark default             | Used for                                    |
| ----------------------- | ------------------------------------------------------------------- | ------------------------ | ------------------------------------------- |
| `--cw-font`             | `system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif` | same     | Font family                                 |
| `--cw-text`             | `#111827`                                                           | `#e5e0db`                | Base text                                   |
| `--cw-muted`            | `#6b7280`                                                           | `#8a8580`                | "Typing…" indicator                         |
| `--cw-panel-bg`         | `#ffffff`                                                           | `#0c0c0c`                | Panel and input bar background              |
| `--cw-list-bg`          | `#f9fafb`                                                           | `#0a0a0a`                | Message list background                     |
| `--cw-border`           | `#e5e7eb`                                                           | `rgba(255,255,255,0.08)` | Panel, assistant bubble, input bar borders  |
| `--cw-accent`           | `#2563eb`                                                           | same                     | Launcher, header, user bubble, send, focus  |
| `--cw-accent-contrast`  | `#ffffff`                                                           | same                     | Text/icons on accent                        |
| `--cw-bubble-bg`        | `#ffffff`                                                           | `rgba(255,255,255,0.04)` | Assistant bubble background                 |
| `--cw-bubble-text`      | `#111827`                                                           | `#e5e0db`                | Assistant bubble text                       |
| `--cw-input-bg`         | `#ffffff`                                                           | `rgba(255,255,255,0.03)` | Textarea background                         |
| `--cw-input-border`     | `#d1d5db`                                                           | `rgba(255,255,255,0.08)` | Textarea border                             |
| `--cw-error-bg`         | `#fef2f2`                                                           | `rgba(185,28,28,0.15)`   | Error banner background                     |
| `--cw-error-text`       | `#b91c1c`                                                           | `#fca5a5`                | Error banner text                           |
| `--cw-shadow`           | `0 12px 40px rgba(0,0,0,0.18)`                                      | same                     | Panel shadow                                |
| `--cw-toggle-shadow`    | `0 6px 20px rgba(0,0,0,0.2)`                                        | same                     | Launcher shadow                             |
| `--cw-radius`           | `12px`                                                              | same                     | Panel and bubbles                           |
| `--cw-radius-sm`        | `8px`                                                               | same                     | Input, send button, error banner            |
| `--cw-header-bg`        | `var(--cw-accent)`                                                  | same                     | Header background                           |
| `--cw-header-text`      | `var(--cw-accent-contrast)`                                         | same                     | Header title and close button               |
| `--cw-header-border`    | `none`                                                              | same                     | Header `border-bottom` shorthand            |
| `--cw-title-font`       | `inherit`                                                           | same                     | Header title font family                    |

Quick accent change, inline:

```tsx
<ChatWidget endpoint="/api/chat" style={{ '--cw-accent': '#c8553d' }} />
```

### Dark theme example

```tsx
<ChatWidget endpoint="/api/chat" variant="dark" className="site-chat" />
```

```css
/* Tune on top of the dark variant: only what differs needs setting. */
.site-chat {
  --cw-accent: #c8553d;
  --cw-font: "DM Sans", ui-sans-serif, system-ui, sans-serif;
  --cw-radius: 10px;
  --cw-radius-sm: 6px;
  --cw-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);

  /* Editorial header: no accent fill, just a hairline. */
  --cw-header-bg: transparent;
  --cw-header-text: #e5e0db;
  --cw-header-border: 1px solid rgba(255, 255, 255, 0.08);
}
```

For deeper changes, every element also has a stable class (`tr-chat-panel`, `tr-chat-header`, `tr-chat-msg-user`, `tr-chat-input`, …) you can target with your own CSS, using `!important` where it needs to beat the inline styles.

## `createChatHandler` options

| Option             | Type                      | Default                                                 |
| ------------------ | ------------------------- | ------------------------------------------------------- |
| `provider`         | `'anthropic' \| 'openai'` | — (required)                                            |
| `apiKey`           | `string`                  | — (required; responds `401` if empty)                   |
| `model`            | `string`                  | `claude-sonnet-4-5` (anthropic), `gpt-4o-mini` (openai) |
| `systemPrompt`     | `string`                  | —                                                       |
| `maxTokens`        | `number`                  | `1024`                                                  |
| `stream`           | `boolean`                 | `false` (`true` responds with SSE)                      |
| `maxMessages`      | `number`                  | `50`                                                    |
| `maxMessageLength` | `number`                  | `8000` characters                                       |
| `onError`          | `(error: unknown) => void`| — (server-side logging hook)                            |

Responses: `200` with `{ reply }` or an SSE stream, `400` for an invalid body, `401` if the API key is missing, `405` for non-POST, `500` with a generic message for any upstream or internal failure. Provider error details are passed to `onError` and never sent to the client.

## Optional styles

Everything is inline-styled. For extras inline styles can't express (focus rings in `--cw-accent`, hover, entry animation that respects `prefers-reduced-motion`):

```ts
import '@trossino/chat-widget/styles';
```

## Notes

- **Streaming:** with `stream: true` the handler converts the provider's stream into the simple `delta` protocol above. The client renders tokens as they arrive and also accepts plain JSON, so you can switch freely.
- **Rate limiting is up to you.** The handler has no auth or rate limiting. Anyone who can reach your endpoint spends your tokens. Put it behind your own auth, rate limiter, or edge middleware (e.g. Upstash, Cloudflare rate limiting rules).
- **API keys:** the widget never handles provider keys. Keep them in server-side env vars. Anything passed via `headers` is visible in the browser.
- **Privacy:** messages go from the browser to your endpoint, then to the provider you configure. Nothing is stored or logged by this package. Disclose the provider to your users as your privacy policy requires.

## License

MIT
