'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useChat } from 'ai/react';
import { Send, BookOpen, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import DocumentUpload from '@/components/DocumentUpload';
import DocumentList from '@/components/DocumentList';

const QUICK_REPLIES = [
  'Summarize the documents',
  'What are the key points?',
  'List all main topics',
  'What does it say about…',
];

// Stable session ID per browser — persisted in localStorage
function useKBSession(): string {
  const [sessionId, setSessionId] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem('kb_session_id');
    if (stored) {
      setSessionId(stored);
    } else {
      const generated = `kb_${Math.random().toString(36).slice(2, 14)}`;
      localStorage.setItem('kb_session_id', generated);
      setSessionId(generated);
    }
  }, []);

  return sessionId;
}

export default function KBPage() {
  const sessionId = useKBSession();

  // Track upload count to re-fetch document list after each upload
  const [uploadCount, setUploadCount] = useState(0);

  const { messages, input, setInput, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/kb/chat',
    body: { data: { sessionId } },
    initialMessages: [
      {
        id: 'welcome',
        role: 'assistant',
        content:
          'Hi! I am your Knowledge Base assistant. Upload documents on the left, then ask me anything about them. I will only answer from the uploaded content.',
      },
    ],
  });

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleUploadDone = useCallback(() => {
    setUploadCount((c) => c + 1);
  }, []);

  if (!sessionId) {
    return (
      <main className="loading-screen">
        <div className="dot-row">
          <span className="dot" /><span className="dot" /><span className="dot" />
        </div>
        <style jsx>{`
          .loading-screen { height:100vh; display:flex; align-items:center; justify-content:center;
            background: radial-gradient(circle at top center, #1a1425 0%, #0a0a0c 100%); }
          .dot-row { display:flex; gap:6px; }
          .dot { width:8px; height:8px; background:var(--primary); border-radius:50%;
            animation:bounce 1.4s infinite ease-in-out both; }
          .dot:nth-child(1){animation-delay:-.32s} .dot:nth-child(2){animation-delay:-.16s}
          @keyframes bounce{0%,80%,100%{transform:scale(0)}40%{transform:scale(1)}}
        `}</style>
      </main>
    );
  }

  return (
    <main className="kb-layout">
      {/* Header */}
      <header className="kb-header glass">
        <div className="header-left">
          <Link href="/" className="back-link">
            <ArrowLeft size={18} />
          </Link>
          <div className="icon-badge">
            <BookOpen size={18} />
          </div>
          <h1>Knowledge <span className="gradient-text">Base</span></h1>
        </div>
        <p className="header-sub">Answers sourced strictly from your uploaded documents</p>
      </header>

      {/* Body */}
      <div className="kb-body">
        {/* Sidebar */}
        <aside className="sidebar glass">
          <h2 className="sidebar-title">Documents</h2>
          <DocumentUpload sessionId={sessionId} onUploaded={handleUploadDone} />
          <div className="doc-list-wrapper">
            <DocumentList sessionId={sessionId} refreshTrigger={uploadCount} />
          </div>
        </aside>

        {/* Chat panel */}
        <div className="chat-panel">
          <div className="chat-container" ref={scrollRef}>
            <div className="messages-wrapper">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`message-row ${m.role === 'user' ? 'user' : 'bot'}`}
                >
                  <div className="bubble glass">
                    <p className="bubble-text">{m.content}</p>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="loading-indicator">
                  <span className="dot" /><span className="dot" /><span className="dot" />
                </div>
              )}
            </div>
          </div>

          {/* Input */}
          <footer className="input-footer">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!sessionId || !input.trim()) return;
                handleSubmit(e, { data: { sessionId } } as any);
              }}
              className="input-form glass premium-shadow"
            >
              <input
                value={input}
                onChange={handleInputChange}
                placeholder="Ask a question about your documents…"
                disabled={isLoading}
                autoFocus
              />
              <button type="submit" className="send-btn" disabled={isLoading || !input.trim()}>
                <Send size={18} />
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
        </div>
      </div>

      <style jsx>{`
        .kb-layout {
          height: 100vh;
          display: flex;
          flex-direction: column;
          background: radial-gradient(circle at top center, #1a1425 0%, #0a0a0c 100%);
          overflow: hidden;
        }
        .kb-header {
          padding: 14px 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-shrink: 0;
          z-index: 10;
        }
        .header-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        :global(.back-link) {
          color: rgba(255,255,255,0.5);
          display: flex;
          align-items: center;
          transition: color 0.2s;
        }
        :global(.back-link:hover) { color: white; }
        .icon-badge {
          background: var(--primary);
          padding: 8px;
          border-radius: 12px;
          display: flex;
          color: white;
        }
        h1 {
          font-size: 20px;
          font-weight: 700;
          letter-spacing: -0.02em;
        }
        .header-sub {
          font-size: 12px;
          color: rgba(255,255,255,0.35);
        }

        .kb-body {
          flex: 1;
          display: flex;
          overflow: hidden;
          gap: 0;
        }

        /* Sidebar */
        .sidebar {
          width: 320px;
          flex-shrink: 0;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          overflow-y: auto;
          border-right: 1px solid rgba(255,255,255,0.06);
        }
        .sidebar-title {
          font-size: 14px;
          font-weight: 700;
          color: rgba(255,255,255,0.6);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          margin: 0;
        }
        .doc-list-wrapper {
          flex: 1;
          overflow-y: auto;
        }

        /* Chat panel */
        .chat-panel {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .chat-container {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
        }
        .messages-wrapper {
          max-width: 760px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .message-row {
          display: flex;
          max-width: 85%;
          animation: fadeIn 0.3s ease-out;
        }
        .message-row.user {
          align-self: flex-end;
          max-width: 72%;
        }
        .bubble {
          padding: 12px 16px;
          border-radius: 12px 12px 12px 2px;
          background: var(--card-bg);
        }
        .message-row.user .bubble {
          border-radius: 12px 12px 2px 12px;
          background: var(--primary);
        }
        .bubble-text {
          font-size: 15px;
          line-height: 1.55;
          white-space: pre-wrap;
          word-break: break-word;
          color: rgba(255,255,255,0.9);
        }
        .message-row.user .bubble-text { color: white; }

        .loading-indicator {
          display: flex;
          gap: 4px;
          padding: 12px 16px;
        }
        .dot {
          width: 6px; height: 6px;
          background: var(--primary);
          border-radius: 50%;
          animation: bounce 1.4s infinite ease-in-out both;
        }
        .dot:nth-child(1){animation-delay:-.32s}
        .dot:nth-child(2){animation-delay:-.16s}
        @keyframes bounce{0%,80%,100%{transform:scale(0)}40%{transform:scale(1)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}

        /* Input area */
        .input-footer {
          padding: 14px 24px 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
        }
        .input-form {
          max-width: 720px;
          width: 100%;
          display: flex;
          padding: 8px 8px 8px 20px;
          border-radius: 20px;
          gap: 10px;
        }
        input {
          flex: 1;
          background: transparent;
          border: none;
          color: white;
          font-size: 15px;
          outline: none;
        }
        input::placeholder { color: rgba(255,255,255,0.35); }
        .send-btn {
          background: var(--primary);
          color: white;
          border: none;
          padding: 10px;
          border-radius: 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          transition: transform 0.2s, background 0.2s;
        }
        .send-btn:hover:not(:disabled) { background: var(--primary-hover); transform: scale(1.05); }
        .send-btn:disabled { opacity: 0.45; cursor: not-allowed; }

        .quick-replies {
          max-width: 720px;
          width: 100%;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .chip {
          background: rgba(139,92,246,0.1);
          border: 1px solid rgba(139,92,246,0.3);
          color: var(--accent);
          font-size: 12px;
          font-weight: 500;
          padding: 5px 12px;
          border-radius: 20px;
          cursor: pointer;
          transition: background 0.2s;
          white-space: nowrap;
        }
        .chip:hover:not(:disabled) { background: rgba(139,92,246,0.22); }
        .chip:disabled { opacity: 0.4; cursor: not-allowed; }
      `}</style>
    </main>
  );
}
