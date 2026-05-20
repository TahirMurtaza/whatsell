'use client';

import React, { useRef, useEffect, useCallback } from 'react';
import { useChat } from 'ai/react';
import { Send, ShoppingBag, Sparkles, BookOpen, LayoutDashboard, ScrollText } from 'lucide-react';
import Link from 'next/link';
import MessageItem from '@/components/MessageItem';

const QUICK_REPLIES = [
  'Show me headphones',
  'Under $50',
  'Best sellers',
  'New arrivals',
  'Top rated',
];

export default function ChatPage() {
  const { messages, input, setInput, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/chat',
    initialMessages: [
      {
        id: 'welcome',
        role: 'assistant',
        content: 'Hi! I am your WhatSell shopping assistant. How can I help you today?',
      },
    ],
  });

  const scrollRef = useRef<HTMLDivElement>(null);

  // Live cart item count
  const [cartCount, setCartCount] = React.useState(0);

  // KB session ID from localStorage (set by /kb page)
  const [kbSessionId, setKbSessionId] = React.useState<string | null>(null);

  // Stable web session ID — persists for the browser tab (sessionStorage),
  // so each new tab/window starts a fresh conversation in the logs.
  const [webSessionId, setWebSessionId] = React.useState<string>('default_session');

  React.useEffect(() => {
    setKbSessionId(localStorage.getItem('kb_session_id'));

    // Reuse existing tab session or generate a new one
    let sid = sessionStorage.getItem('whatsell_session_id');
    if (!sid) {
      sid = 'web_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now().toString(36);
      sessionStorage.setItem('whatsell_session_id', sid);
    }
    setWebSessionId(sid);
  }, []);

  // Derive sessionId from the first assistant message annotation that carries it
  const sessionId =
    messages
      .flatMap((m) => (m.annotations as any[]) ?? [])
      .find((a) => a?.sessionId)?.sessionId ?? webSessionId;

  // Fetch live cart count
  const refreshCartCount = useCallback(async () => {
    if (!sessionId || sessionId === 'default_session') return;
    try {
      const res = await fetch(`/api/cart/${sessionId}`);
      if (res.ok) {
        const cart = await res.json();
        setCartCount(cart.item_count ?? 0);
      }
    } catch {
      // non-critical — silently ignore
    }
  }, [sessionId]);

  useEffect(() => {
    refreshCartCount();
  }, [refreshCartCount]);

  // Add to cart handler — called by ProductCard via MessageItem
  const handleAddToCart = useCallback(
    async (product: any) => {
      try {
        const res = await fetch(`/api/cart/${sessionId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'add', product_id: product.id, quantity: 1 }),
        });
        if (res.ok) await refreshCartCount();
      } catch {
        // non-critical — silently ignore
      }
    },
    [sessionId, refreshCartCount]
  );

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <main className="chat-layout">
      {/* Header */}
      <header className="chat-header glass">
        <div className="logo-section">
          <div className="icon-badge">
            <Sparkles size={20} className="sparkle-icon" />
          </div>
          <h1>WhatSell <span className="gradient-text">AI</span></h1>
        </div>
        <div className="header-actions">
          <Link href="/admin" className="kb-link" title="Admin Dashboard">
            <LayoutDashboard size={20} />
          </Link>
          <Link href="/logs" className="kb-link" title="Session Logs">
            <ScrollText size={20} />
          </Link>
          <Link href="/kb" className="kb-link" title="Knowledge Base">
            <BookOpen size={20} />
          </Link>
          <div className="cart-status">
            <ShoppingBag size={20} />
            {cartCount > 0 && <span className="badge">{cartCount}</span>}
          </div>
        </div>
      </header>

      {/* Chat Area */}
      <div className="chat-container" ref={scrollRef}>
        <div className="messages-wrapper">
          {messages.map((m) => {
            // Products are pinned to the message via appendMessageAnnotation
            const annotation = (m.annotations as any[])?.find((a) => a?.type === 'products');
            const messageProducts = annotation?.products ?? undefined;
            return (
              <MessageItem
                key={m.id}
                message={m}
                products={m.role === 'assistant' ? messageProducts : undefined}
                onAddToCart={handleAddToCart}
              />
            );
          })}
          {isLoading && (
            <div className="loading-indicator">
              <span className="dot"></span>
              <span className="dot"></span>
              <span className="dot"></span>
            </div>
          )}
        </div>
      </div>

      {/* Input Area */}
      <footer className="input-footer">
        <form onSubmit={(e) => handleSubmit(e, { data: { kbSessionId, sessionId: webSessionId } } as any)} className="input-form glass premium-shadow">
          <input
            value={input}
            onChange={handleInputChange}
            placeholder="Search products or ask a question..."
            disabled={isLoading}
            autoFocus
          />
          <button type="submit" className="send-btn" disabled={isLoading || !input.trim()}>
            <Send size={20} />
          </button>
        </form>

        <div className="quick-replies">
          {QUICK_REPLIES.map((chip) => (
            <button
              key={chip}
              type="button"
              className="chip"
              onClick={() => setInput(chip)}
              disabled={isLoading}
            >
              {chip}
            </button>
          ))}
        </div>
      </footer>

      <style jsx>{`
        .chat-layout {
          height: 100vh;
          display: flex;
          flex-direction: column;
          background: radial-gradient(circle at top center, #1a1425 0%, #0a0a0c 100%);
        }
        .chat-header {
          padding: 16px 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          z-index: 10;
        }
        .logo-section {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .icon-badge {
          background: var(--primary);
          padding: 8px;
          border-radius: 12px;
          display: flex;
        }
        h1 {
          font-size: 20px;
          font-weight: 700;
          letter-spacing: -0.02em;
        }
        .header-actions {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        :global(.kb-link) {
          color: rgba(255,255,255,0.55);
          display: flex;
          align-items: center;
          transition: color 0.2s;
        }
        :global(.kb-link:hover) {
          color: var(--accent);
        }
        .cart-status {
          position: relative;
          cursor: pointer;
        }
        .badge {
          position: absolute;
          top: -8px;
          right: -8px;
          background: var(--accent);
          color: white;
          font-size: 10px;
          padding: 2px 6px;
          border-radius: 10px;
          font-weight: 700;
          min-width: 18px;
          text-align: center;
        }
        .chat-container {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
          display: flex;
          flex-direction: column;
        }
        .messages-wrapper {
          max-width: 900px;
          width: 100%;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
        }
        .input-footer {
          padding: 16px 24px 24px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
        }
        .input-form {
          max-width: 800px;
          width: 100%;
          display: flex;
          padding: 8px 8px 8px 24px;
          border-radius: 20px;
          gap: 12px;
        }
        input {
          flex: 1;
          background: transparent;
          border: none;
          color: white;
          font-size: 16px;
          outline: none;
        }
        .send-btn {
          background: var(--primary);
          color: white;
          border: none;
          padding: 12px;
          border-radius: 14px;
          cursor: pointer;
          transition: transform 0.2s, background 0.2s;
        }
        .send-btn:hover:not(:disabled) {
          background: var(--primary-hover);
          transform: scale(1.05);
        }
        .send-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .quick-replies {
          max-width: 800px;
          width: 100%;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          padding: 0 4px;
        }
        .chip {
          background: rgba(139, 92, 246, 0.1);
          border: 1px solid rgba(139, 92, 246, 0.3);
          color: var(--accent);
          font-size: 13px;
          font-weight: 500;
          padding: 6px 14px;
          border-radius: 20px;
          cursor: pointer;
          transition: background 0.2s, border-color 0.2s;
          white-space: nowrap;
        }
        .chip:hover:not(:disabled) {
          background: rgba(139, 92, 246, 0.25);
          border-color: var(--primary);
        }
        .chip:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .loading-indicator {
          display: flex;
          gap: 4px;
          padding: 12px;
        }
        .dot {
          width: 6px;
          height: 6px;
          background: var(--primary);
          border-radius: 50%;
          animation: bounce 1.4s infinite ease-in-out both;
        }
        .dot:nth-child(1) { animation-delay: -0.32s; }
        .dot:nth-child(2) { animation-delay: -0.16s; }

        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1.0); }
        }
      `}</style>
    </main>
  );
}
