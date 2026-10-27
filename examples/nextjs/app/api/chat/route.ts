import { createChatHandler } from '@trossino/chat-widget/server';

// The API key stays on the server: set ANTHROPIC_API_KEY in .env.local.
export const POST = createChatHandler({
  provider: 'anthropic',
  apiKey: process.env.ANTHROPIC_API_KEY ?? '',
  systemPrompt: 'You are a concise, friendly assistant for the Example Co. website.',
  maxTokens: 1024,
  stream: true,
  onError: (error) => console.error('[chat]', error),
});
