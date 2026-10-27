import { ChatWidget } from '@trossino/chat-widget';
import '@trossino/chat-widget/styles';

export default function Page() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 40 }}>
      <h1>Example Co.</h1>
      <p>The chat button is in the bottom-right corner.</p>
      <ChatWidget endpoint="/api/chat" title="Ask Example Co." welcomeMessage="Hi! How can I help you today?" />
    </main>
  );
}
