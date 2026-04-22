'use client';

import React from 'react';
import { User, Bot } from 'lucide-react';
import { Message } from 'ai';
import ProductCard from './ProductCard';

interface MessageItemProps {
  message: Message;
  products?: any[];
  onAddToCart?: (product: any) => void;
}

export default function MessageItem({ message, products, onAddToCart }: MessageItemProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`message-container ${isUser ? 'user' : 'bot'}`}>
      <div className="avatar">
        {isUser ? <User size={18} /> : <Bot size={18} />}
      </div>
      <div className="bubble-wrapper">
        <div className="bubble glass">
          <p className="content">{message.content}</p>
        </div>
        
        {products && products.length > 0 && (
          <div className="product-scroll">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} onAddToCart={onAddToCart} />
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        .message-container {
          display: flex;
          gap: 12px;
          margin-bottom: 24px;
          max-width: 85%;
          animation: fadeIn 0.3s ease-out;
        }
        .message-container.user {
          align-self: flex-end;
          flex-direction: row-reverse;
          max-width: 75%;
        }
        .avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--border);
        }
        .user .avatar {
          background: var(--primary);
          border: none;
        }
        .bubble-wrapper {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .bubble {
          padding: 12px 16px;
          border-radius: 12px 12px 12px 2px;
          background: var(--card-bg);
          font-size: 15px;
          line-height: 1.5;
        }
        .user .bubble {
          border-radius: 12px 12px 2px 12px;
          background: var(--primary);
          color: white;
        }
        .product-scroll {
          display: flex;
          gap: 16px;
          overflow-x: auto;
          margin-top: 8px;
          padding: 4px 4px 16px 4px;
          width: calc(100vw - 80px);
          max-width: 850px;
          scroll-snap-type: x mandatory;
          scroll-behavior: smooth;
          -webkit-overflow-scrolling: touch;
        }
        .product-scroll > :global(*) {
          scroll-snap-align: start;
        }
        /* Custom Scrollbar for premium feel */
        .product-scroll::-webkit-scrollbar {
          height: 6px;
        }
        .product-scroll::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }
        .product-scroll::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .product-scroll::-webkit-scrollbar-thumb:hover {
          background: var(--primary);
        }
        .content {
          white-space: pre-wrap;
          word-break: break-word;
        }

      `}</style>
    </div>
  );
}
