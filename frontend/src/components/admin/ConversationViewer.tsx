'use client';
import { User, Bot } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string | null;
  metadata: Record<string, any>;
}

export default function ConversationViewer({ messages }: { messages: Message[] }) {
  if (!messages.length) {
    return <p style={{ color: 'rgba(255,255,255,0.4)', padding: '24px' }}>No messages yet.</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px' }}>
      {messages.map((m) => {
        const isUser = m.role === 'user';
        return (
          <div
            key={m.id}
            style={{
              display: 'flex',
              flexDirection: isUser ? 'row-reverse' : 'row',
              gap: '10px',
              alignItems: 'flex-start',
            }}
          >
            {/* Avatar */}
            <div style={{
              width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
              background: isUser ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {isUser
                ? <User size={16} color="#fff" />
                : <Bot size={16} color="rgba(255,255,255,0.7)" />}
            </div>

            {/* Bubble */}
            <div style={{ maxWidth: '75%' }}>
              <div style={{
                background: isUser ? 'var(--primary)' : 'var(--card-bg)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: isUser ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                padding: '10px 14px',
                fontSize: 14,
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}>
                {m.content}
              </div>
              <div style={{
                display: 'flex', gap: 8, marginTop: 4,
                flexDirection: isUser ? 'row-reverse' : 'row',
                alignItems: 'center',
              }}>
                {m.timestamp && (
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                    {new Date(m.timestamp).toLocaleTimeString()}
                  </span>
                )}
                {m.metadata?.type && (
                  <span style={{
                    fontSize: 10, padding: '1px 6px', borderRadius: 4,
                    background: m.metadata.type === 'product'
                      ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.07)',
                    color: m.metadata.type === 'product' ? '#818cf8' : 'rgba(255,255,255,0.4)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}>
                    {m.metadata.type}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
