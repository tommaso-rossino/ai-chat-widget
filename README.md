# @tommaso-rossino/chat-widget

Batteries-included React chat widget, plus an optional framework-agnostic server handler for Anthropic and OpenAI.

- Drop-in UI: floating bottom-right panel, fully styled inline (no Tailwind, no CSS file required).
- Zero runtime dependencies: native `fetch`, Web `Request`/`Response`.
- JSON or SSE streaming responses, detected automatically from `Content-Type`.
- Works with Next.js App Router, Vercel, Cloudflare Workers, Deno, Bun, or any Web-standard runtime.
- Accessible: labelled controls, `role="log"` live region, Enter to send, Shift+Enter for newline, Esc to close.

## Install

```bash
npm i @tommaso-rossino/chat-widget
```

Peer dependencies: `react` and `react-dom` 18 or 19.

## Client only (your own endpoint)

```tsx
import { ChatWidget } from '@tommaso-rossino/chat-widget';

export default function App() {
  return <ChatWidget endpoint="/api/my-chat" title="Support" welcomeMessage="Hi! How can I help?" />;
}
```

Your endpoint receives `POST { messages: Array<{ role: 'user' | 'assistant', content: string }> }` and must answer with either:

- JSON: `{ "reply": "..." }`
- SSE (`Content-Type: text/event-stream`): `data: {"delta":"..."}` events, ending with `data: [DONE]`. Errors: `event: error` + `data: {"error":"..."}`.

Want your own UI? Use the hook directly:

```tsx
import { useChat } from '@tommaso-rossino/chat-widget';

const { messages, loading, error, send, stop, reset } = useChat({ endpoint: '/api/chat' });
```

## Batteries included (Next.js App Router)

`app/api/chat/route.ts`:

```ts
import { createChatHandler } from '@tommaso-rossino/chat-widget/server';

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
import { ChatWidget } from '@tommaso-rossino/chat-widget';

export default function Page() {
  return <ChatWidget endpoint="/api/chat" title="Ask me anything" />;
}
```

The client bundle ships with `"use client"`, so it can be rendered from Server Components. See [`examples/nextjs`](./examples/nextjs) for a full app.

The handler is a plain `(req: Request) => Promise<Response>`, so it also works as a Cloudflare Worker (`export default { fetch: handler }`) or with `Deno.serve(handler)`.

## `<ChatWidget>` props

| Prop             | Type                     | Default             | Description                                                              |
| ---------------- | ------------------------ | ------------------- | ------------------------------------------------------------------------ |
| `endpoint`       | `string`                 | —                   | URL receiving `POST { messages }`. Required.                             |
| `headers`        | `Record<string, string>` | —                   | Extra request headers (e.g. a session token). **Never a provider key.**  |
| `placeholder`    | `string`                 | `"Type a message…"` | Input placeholder.                                                       |
| `title`          | `string`                 | `"Chat"`            | Panel title.                                                             |
| `welcomeMessage` | `string`                 | —                   | Shown when the conversation is empty. Display-only, not sent to the API. |
| `onError`        | `(error: Error) => void` | —                   | Called on network, HTTP, or stream errors.                               |
| `defaultOpen`    | `boolean`                | `false`             | Open the panel on mount.                                                 |

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

Everything is inline-styled. For extras inline styles can't express (focus rings, hover, entry animation that respects `prefers-reduced-motion`):

```ts
import '@tommaso-rossino/chat-widget/styles';
```

## Notes

- **Streaming:** with `stream: true` the handler converts the provider's stream into the simple `delta` protocol above. The client renders tokens as they arrive and also accepts plain JSON, so you can switch freely.
- **Rate limiting is up to you.** The handler has no auth or rate limiting. Anyone who can reach your endpoint spends your tokens. Put it behind your own auth, rate limiter, or edge middleware (e.g. Upstash, Cloudflare rate limiting rules).
- **API keys:** the widget never handles provider keys. Keep them in server-side env vars. Anything passed via `headers` is visible in the browser.
- **Privacy:** messages go from the browser to your endpoint, then to the provider you configure. Nothing is stored or logged by this package. Disclose the provider to your users as your privacy policy requires.

## License

MIT
