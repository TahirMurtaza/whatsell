'use client';

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useChat } from 'ai/react';
import { Send, Sparkles, X, ShoppingCart, Check, BookOpen, FileText, Upload } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import MessageItem from '@/components/MessageItem';
import DocumentUpload from '@/components/DocumentUpload';
import DocumentList from '@/components/DocumentList';

const QUICK_REPLIES = [
  'Show me headphones',
  'Under $50',
  'Best sellers',
  'New arrivals',
  'Top rated',
];

const KB_SUGGESTIONS = [
  { label: 'FAQ', desc: 'Frequently asked questions' },
  { label: 'Privacy Policy', desc: 'Data handling & terms' },
  { label: 'Company Info', desc: 'About your business' },
  { label: 'Return Policy', desc: 'Refunds & exchanges' },
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

  // KB panel state
  const [kbOpen, setKbOpen] = useState(false);
  const [kbSessionId, setKbSessionId] = useState<string | null>(null);
  const [kbUploadCount, setKbUploadCount] = useState(0);
  const [kbDocCount, setKbDocCount] = useState(0);

  // Quick view product
  const [quickViewProduct, setQuickViewProduct] = useState<any | null>(null);
  const [qvAdded, setQvAdded] = useState(false);

  // Stable web session ID
  const [webSessionId, setWebSessionId] = useState<string>('default_session');

  useEffect(() => {
    // KB session — reuse from localStorage or generate
    let kbSid = localStorage.getItem('kb_session_id');
    if (!kbSid) {
      kbSid = `kb_${Math.random().toString(36).slice(2, 14)}`;
      localStorage.setItem('kb_session_id', kbSid);
    }
    setKbSessionId(kbSid);

    // Chat session — per tab
    let sid = sessionStorage.getItem('whatsell_session_id');
    if (!sid) {
      sid = 'web_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now().toString(36);
      sessionStorage.setItem('whatsell_session_id', sid);
    }
    setWebSessionId(sid);
  }, []);

  // Derive sessionId from first assistant annotation
  const sessionId =
    messages
      .flatMap((m) => (m.annotations as any[]) ?? [])
      .find((a) => a?.sessionId)?.sessionId ?? webSessionId;

  // Cart (used by ProductCard checkout flow, not shown in header)
  const refreshCartCount = useCallback(async () => {
    if (!sessionId || sessionId === 'default_session') return;
    try { await fetch(`/api/cart/${sessionId}`); } catch { /* non-critical */ }
  }, [sessionId]);

  useEffect(() => { refreshCartCount(); }, [refreshCartCount]);

  const handleAddToCart = useCallback(async (product: any) => {
    try {
      await fetch(`/api/cart/${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', product_id: product.id, quantity: 1 }),
      });
      await refreshCartCount();
    } catch { /* non-critical */ }
  }, [sessionId, refreshCartCount]);

  const handleQuickView = useCallback((product: any) => {
    setQuickViewProduct(product);
    setQvAdded(false);
  }, []);

  const handleQvAddToCart = useCallback(async () => {
    if (!quickViewProduct) return;
    await handleAddToCart(quickViewProduct);
    setQvAdded(true);
    setTimeout(() => setQvAdded(false), 2000);
  }, [quickViewProduct, handleAddToCart]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleUploadDone = useCallback(() => {
    setKbUploadCount((c) => c + 1);
  }, []);

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
          {/* KB status indicator */}
          {kbDocCount > 0 && (
            <span className="kb-active-badge">
              <FileText size={11} />
              {kbDocCount} doc{kbDocCount !== 1 ? 's' : ''} active
            </span>
          )}
          <button
            className={`kb-btn ${kbOpen ? 'active' : ''}`}
            onClick={() => setKbOpen((v) => !v)}
            title="Knowledge Base"
          >
            <BookOpen size={18} />
            <span>Knowledge Base</span>
          </button>
        </div>
      </header>

      {/* Chat Area */}
      <div className="chat-container" ref={scrollRef}>
        <div className="messages-wrapper">
          {messages.map((m) => {
            const annotation = (m.annotations as any[])?.find((a) => a?.type === 'products');
            const messageProducts = annotation?.products ?? undefined;
            return (
              <MessageItem
                key={m.id}
                message={m}
                products={m.role === 'assistant' ? messageProducts : undefined}
                onAddToCart={handleAddToCart}
                onQuickView={handleQuickView}
              />
            );
          })}
          {isLoading && (
            <div className="loading-indicator">
              <span className="dot" /><span className="dot" /><span className="dot" />
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
            <button key={chip} type="button" className="chip" onClick={() => setInput(chip)} disabled={isLoading}>
              {chip}
            </button>
          ))}
        </div>
      </footer>

      {/* ── Knowledge Base Drawer ── */}
      <AnimatePresence>
        {kbOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              className="kb-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setKbOpen(false)}
            />
            {/* Panel */}
            <motion.aside
              className="kb-drawer"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            >
              {/* Drawer header */}
              <div className="kb-drawer-header">
                <div className="kb-drawer-title">
                  <BookOpen size={18} style={{ color: 'var(--accent)' }} />
                  <span>Knowledge Base</span>
                </div>
                <button className="kb-close-btn" onClick={() => setKbOpen(false)}>
                  <X size={16} />
                </button>
              </div>

              {/* Description */}
              <div className="kb-drawer-desc">
                Upload company documents so the AI can answer questions about your business, policies, and FAQs.
              </div>

              {/* Suggestion chips */}
              <div className="kb-suggestions">
                {KB_SUGGESTIONS.map((s) => (
                  <div key={s.label} className="kb-suggestion-chip">
                    <FileText size={13} />
                    <div>
                      <div className="kb-suggestion-label">{s.label}</div>
                      <div className="kb-suggestion-desc">{s.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Upload + list */}
              {kbSessionId ? (
                <div className="kb-drawer-body">
                  <DocumentUpload sessionId={kbSessionId} onUploaded={handleUploadDone} />
                  <div className="kb-divider" />
                  <DocumentList
                    sessionId={kbSessionId}
                    refreshTrigger={kbUploadCount}
                    onCountChange={setKbDocCount}
                  />
                </div>
              ) : (
                <div className="kb-loading">Initializing…</div>
              )}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Quick View Modal */}
      <AnimatePresence>
        {quickViewProduct && (
          <motion.div className="qv-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setQuickViewProduct(null)}>
            <motion.div
              className="qv-modal glass premium-shadow"
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
            >
              <button className="qv-close" onClick={() => setQuickViewProduct(null)}><X size={18} /></button>
              <div className="qv-image">
                <img src={quickViewProduct.image_urls?.[0] || 'https://placehold.co/400x300/1a1a2e/c084fc?text=Product'} alt={quickViewProduct.name} />
                {quickViewProduct.category && <span className="qv-category">{quickViewProduct.category}</span>}
              </div>
              <div className="qv-details">
                <h3 className="qv-name">{quickViewProduct.name}</h3>
                <div className="qv-price-row">
                  <span className="qv-price">${quickViewProduct.price?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  {quickViewProduct.compare_at_price && quickViewProduct.compare_at_price > quickViewProduct.price && (
                    <>
                      <span className="qv-compare">${quickViewProduct.compare_at_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      <span className="qv-discount">-{Math.round(((quickViewProduct.compare_at_price - quickViewProduct.price) / quickViewProduct.compare_at_price) * 100)}%</span>
                    </>
                  )}
                </div>
                {quickViewProduct.sku && <p className="qv-sku">SKU: {quickViewProduct.sku}</p>}
                <div className="qv-desc"><h4>Description</h4><p>{quickViewProduct.description || 'No description available.'}</p></div>
                {quickViewProduct.tags?.length > 0 && (
                  <div className="qv-tags">{quickViewProduct.tags.map((tag: string) => <span key={tag} className="qv-tag">{tag}</span>)}</div>
                )}
                <div className="qv-stock-row">
                  {(quickViewProduct.stock_quantity ?? 999) === 0 ? <span className="qv-stock out">Out of stock</span>
                    : (quickViewProduct.stock_quantity ?? 999) <= 5 ? <span className="qv-stock low">Only {quickViewProduct.stock_quantity} left</span>
                    : <span className="qv-stock in">In stock</span>}
                </div>
                <button className={`qv-add-btn ${qvAdded ? 'added' : ''}`} onClick={handleQvAddToCart} disabled={(quickViewProduct.stock_quantity ?? 999) === 0}>
                  <ShoppingCart size={18} />{qvAdded ? 'Added to Cart!' : 'Add to Cart'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx>{`
        .chat-layout { height: 100vh; display: flex; flex-direction: column; background: radial-gradient(circle at top center, #1a1425 0%, #0a0a0c 100%); overflow: hidden; }
        .chat-header { padding: 12px 20px; display: flex; justify-content: space-between; align-items: center; z-index: 10; flex-shrink: 0; }
        .logo-section { display: flex; align-items: center; gap: 12px; }
        .icon-badge { background: var(--primary); padding: 8px; border-radius: 12px; display: flex; }
        h1 { font-size: 20px; font-weight: 700; letter-spacing: -0.02em; }
        .header-actions { display: flex; align-items: center; gap: 10px; }
        .kb-active-badge {
          display: flex; align-items: center; gap: 5px;
          font-size: 11px; font-weight: 600;
          color: #10b981;
          background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.25);
          padding: 4px 10px; border-radius: 20px;
        }
        .kb-btn {
          display: flex; align-items: center; gap: 7px;
          background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
          color: rgba(255,255,255,0.65); font-size: 13px; font-weight: 500;
          padding: 7px 14px; border-radius: 10px; cursor: pointer;
          transition: all 0.15s;
        }
        .kb-btn:hover { background: rgba(139,92,246,0.12); border-color: rgba(139,92,246,0.3); color: var(--accent); }
        .kb-btn.active { background: rgba(139,92,246,0.18); border-color: rgba(139,92,246,0.4); color: var(--accent); }
        .chat-container { flex: 1; overflow-y: auto; padding: 24px; display: flex; flex-direction: column; }
        .messages-wrapper { max-width: 900px; width: 100%; margin: 0 auto; display: flex; flex-direction: column; }
        .input-footer { padding: 16px 24px 24px; display: flex; flex-direction: column; align-items: center; gap: 10px; flex-shrink: 0; }
        .input-form { max-width: 800px; width: 100%; display: flex; padding: 8px 8px 8px 24px; border-radius: 20px; gap: 12px; }
        input { flex: 1; background: transparent; border: none; color: white; font-size: 16px; outline: none; }
        .send-btn { background: var(--primary); color: white; border: none; padding: 12px; border-radius: 14px; cursor: pointer; transition: transform 0.2s, background 0.2s; }
        .send-btn:hover:not(:disabled) { background: var(--primary-hover); transform: scale(1.05); }
        .send-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .quick-replies { max-width: 800px; width: 100%; display: flex; flex-wrap: wrap; gap: 8px; padding: 0 4px; }
        .chip { background: rgba(139,92,246,0.1); border: 1px solid rgba(139,92,246,0.3); color: var(--accent); font-size: 13px; font-weight: 500; padding: 6px 14px; border-radius: 20px; cursor: pointer; transition: background 0.2s, border-color 0.2s; white-space: nowrap; }
        .chip:hover:not(:disabled) { background: rgba(139,92,246,0.25); border-color: var(--primary); }
        .chip:disabled { opacity: 0.4; cursor: not-allowed; }
        .loading-indicator { display: flex; gap: 4px; padding: 12px; }
        .dot { width: 6px; height: 6px; background: var(--primary); border-radius: 50%; animation: bounce 1.4s infinite ease-in-out both; }
        .dot:nth-child(1) { animation-delay: -0.32s; }
        .dot:nth-child(2) { animation-delay: -0.16s; }
        @keyframes bounce { 0%, 80%, 100% { transform: scale(0); } 40% { transform: scale(1.0); } }

        /* ── KB Drawer ── */
        .kb-backdrop { position: fixed; inset: 0; z-index: 200; background: rgba(0,0,0,0.4); backdrop-filter: blur(2px); }
        .kb-drawer {
          position: fixed; top: 0; right: 0; bottom: 0; z-index: 201;
          width: 380px; background: #0f0f13;
          border-left: 1px solid rgba(255,255,255,0.08);
          display: flex; flex-direction: column; overflow: hidden;
        }
        .kb-drawer-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.07);
          flex-shrink: 0;
        }
        .kb-drawer-title { display: flex; align-items: center; gap: 10px; font-size: 15px; font-weight: 700; }
        .kb-close-btn {
          width: 30px; height: 30px; border-radius: 8px;
          background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.08);
          color: rgba(255,255,255,0.5); display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: all 0.15s;
        }
        .kb-close-btn:hover { background: rgba(239,68,68,0.15); border-color: rgba(239,68,68,0.3); color: #ef4444; }
        .kb-drawer-desc {
          padding: 14px 20px; font-size: 13px; color: rgba(255,255,255,0.45); line-height: 1.6;
          border-bottom: 1px solid rgba(255,255,255,0.05); flex-shrink: 0;
        }
        .kb-suggestions {
          display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
          padding: 14px 20px; border-bottom: 1px solid rgba(255,255,255,0.05); flex-shrink: 0;
        }
        .kb-suggestion-chip {
          display: flex; align-items: flex-start; gap: 8px;
          padding: 10px 12px; border-radius: 10px;
          background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07);
          color: rgba(255,255,255,0.5);
        }
        .kb-suggestion-label { font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.75); }
        .kb-suggestion-desc { font-size: 10px; color: rgba(255,255,255,0.35); margin-top: 1px; }
        .kb-drawer-body { flex: 1; overflow-y: auto; padding: 16px 20px; display: flex; flex-direction: column; gap: 0; }
        .kb-divider { height: 1px; background: rgba(255,255,255,0.06); margin: 16px 0; flex-shrink: 0; }
        .kb-loading { flex: 1; display: flex; align-items: center; justify-content: center; color: rgba(255,255,255,0.3); font-size: 13px; }

        /* ── Quick View ── */
        .qv-overlay { position: fixed; inset: 0; z-index: 1000; background: rgba(0,0,0,0.65); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; padding: 24px; }
        .qv-modal { position: relative; width: 100%; max-width: 520px; max-height: 85vh; overflow-y: auto; border-radius: 20px; background: #16161a; border: 1px solid rgba(255,255,255,0.1); }
        .qv-close { position: absolute; top: 12px; right: 12px; z-index: 10; width: 32px; height: 32px; border-radius: 50%; border: none; background: rgba(0,0,0,0.5); backdrop-filter: blur(8px); color: white; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: background 0.2s; }
        .qv-close:hover { background: var(--error); }
        .qv-image { height: 300px; position: relative; overflow: hidden; background: #0f0f13; }
        .qv-image img { width: 100%; height: 100%; object-fit: cover; }
        .qv-category { position: absolute; top: 12px; left: 12px; font-size: 11px; font-weight: 700; text-transform: uppercase; background: var(--primary); padding: 4px 12px; border-radius: 16px; color: white; }
        .qv-details { padding: 24px; display: flex; flex-direction: column; gap: 10px; }
        .qv-name { font-size: 20px; font-weight: 700; color: #fff; line-height: 1.3; }
        .qv-price-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .qv-price { font-size: 24px; font-weight: 800; color: var(--accent); }
        .qv-compare { font-size: 16px; color: rgba(255,255,255,0.35); text-decoration: line-through; }
        .qv-discount { font-size: 12px; font-weight: 700; background: var(--error); color: white; padding: 3px 8px; border-radius: 10px; }
        .qv-sku { font-size: 13px; color: rgba(255,255,255,0.4); }
        .qv-desc h4 { font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.6); margin-bottom: 4px; }
        .qv-desc p { font-size: 14px; color: rgba(255,255,255,0.5); line-height: 1.6; }
        .qv-tags { display: flex; flex-wrap: wrap; gap: 6px; }
        .qv-tag { font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 12px; background: rgba(139,92,246,0.12); color: var(--accent); border: 1px solid rgba(139,92,246,0.25); }
        .qv-stock-row { margin-top: 2px; }
        .qv-stock { font-size: 12px; font-weight: 600; padding: 4px 12px; border-radius: 12px; }
        .qv-stock.in { background: rgba(16,185,129,0.12); color: var(--success); border: 1px solid rgba(16,185,129,0.25); }
        .qv-stock.low { background: rgba(245,158,11,0.12); color: #f59e0b; border: 1px solid rgba(245,158,11,0.25); }
        .qv-stock.out { background: rgba(239,68,68,0.12); color: var(--error); border: 1px solid rgba(239,68,68,0.25); }
        .qv-add-btn { margin-top: auto; background: linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%); color: white; border: none; padding: 14px; border-radius: 14px; display: flex; align-items: center; justify-content: center; gap: 10px; font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.3s; }
        .qv-add-btn.added { background: linear-gradient(135deg, var(--success) 0%, #059669 100%); }
        .qv-add-btn:hover:not(:disabled) { box-shadow: 0 8px 24px rgba(139,92,246,0.4); transform: translateY(-2px); }
        .qv-add-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; box-shadow: none; }
      `}</style>
    </main>
  );
}
