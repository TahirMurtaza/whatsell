'use client';

import React, { useState } from 'react';
import { ShoppingCart, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Product {
  id: number;
  name: string;
  price: number;
  compare_at_price?: number | null;
  description?: string;
  image_urls?: string[];
  category?: string;
  sku?: string;
  tags?: string[];
  stock_quantity?: number;
}

interface ProductCardProps {
  product: Product;
  onAddToCart?: (product: Product) => void;
}

export default function ProductCard({ product, onAddToCart }: ProductCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [added, setAdded] = useState(false);

  const imageUrl = product.image_urls?.[0] || 'https://placehold.co/300x200/1a1a2e/c084fc?text=Product';

  const discountPct =
    product.compare_at_price && product.compare_at_price > product.price
      ? Math.round(((product.compare_at_price - product.price) / product.compare_at_price) * 100)
      : null;

  const stockQty = product.stock_quantity ?? 999;
  const inStock = stockQty > 0;
  const lowStock = inStock && stockQty <= 5;

  const handleAddToCart = () => {
    if (!inStock || added) return;
    onAddToCart?.(product);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <motion.div
      className="product-card glass premium-shadow"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -8 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="image-container">
        <img src={imageUrl} alt={product.name} className={isHovered ? 'zoom' : ''} />
        <div className="overlay-tags">
          {product.category && <span className="category-tag">{product.category}</span>}
          {discountPct && <span className="sale-badge">-{discountPct}%</span>}
        </div>
      </div>

      <div className="content">
        <div className="header-info">
          <h3 className="product-name">{product.name}</h3>
          <div className="price-block">
            <p className="product-price">
              ${product.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
            {discountPct && product.compare_at_price && (
              <p className="compare-price">
                ${product.compare_at_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            )}
          </div>
        </div>

        <div className="description-container">
          <p className={`product-description ${isHovered ? 'expanded' : ''}`}>
            {product.description || 'No description available for this premium item.'}
          </p>
        </div>

        <div className="meta-row">
          {!inStock ? (
            <span className="stock-badge out-of-stock">Out of stock</span>
          ) : lowStock ? (
            <span className="stock-badge low-stock">Only {stockQty} left</span>
          ) : (
            <span className="stock-badge in-stock">In stock</span>
          )}
        </div>

        {product.tags && product.tags.length > 0 && (
          <div className="tags-row">
            {product.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="tag-pill">{tag}</span>
            ))}
          </div>
        )}

        <div className="card-footer">
          <button
            className={`add-to-cart-btn ${added ? 'added' : ''}`}
            onClick={handleAddToCart}
            disabled={!inStock}
          >
            <AnimatePresence mode="wait" initial={false}>
              {added ? (
                <motion.span
                  key="check"
                  className="btn-inner"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                >
                  <Check size={16} />
                  <span>Added!</span>
                </motion.span>
              ) : (
                <motion.span
                  key="cart"
                  className="btn-inner"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                >
                  <ShoppingCart size={16} />
                  <span>Add to Cart</span>
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
      </div>

      <style jsx>{`
        .product-card {
          width: 260px;
          border-radius: 24px;
          overflow: hidden;
          flex-shrink: 0;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          flex-direction: column;
        }
        .image-container {
          height: 180px;
          position: relative;
          overflow: hidden;
          background: #0f0f13;
        }
        img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.6s cubic-bezier(0.33, 1, 0.68, 1);
        }
        img.zoom {
          transform: scale(1.1);
        }
        .overlay-tags {
          position: absolute;
          top: 12px;
          left: 12px;
          z-index: 2;
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }
        .category-tag {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          background: var(--primary);
          padding: 4px 10px;
          border-radius: 20px;
          color: white;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }
        .sale-badge {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.03em;
          background: var(--error);
          color: white;
          padding: 4px 10px;
          border-radius: 20px;
          box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
        }
        .content {
          padding: 20px;
          display: flex;
          flex-direction: column;
          flex: 1;
        }
        .header-info {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 12px;
          gap: 12px;
        }
        .product-name {
          font-size: 15px;
          font-weight: 700;
          color: #fff;
          line-height: 1.3;
          flex: 1;
        }
        .price-block {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 2px;
        }
        .product-price {
          font-size: 16px;
          color: var(--accent);
          font-weight: 800;
          white-space: nowrap;
        }
        .compare-price {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.35);
          text-decoration: line-through;
          font-weight: 500;
          white-space: nowrap;
        }
        .description-container {
          margin-bottom: 12px;
          height: 40px;
        }
        .product-description {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.5);
          line-height: 1.5;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          transition: color 0.3s;
        }
        .product-description.expanded {
          color: rgba(255, 255, 255, 0.85);
        }
        .meta-row {
          margin-bottom: 8px;
        }
        .stock-badge {
          font-size: 11px;
          font-weight: 600;
          padding: 3px 10px;
          border-radius: 20px;
        }
        .in-stock {
          background: rgba(16, 185, 129, 0.12);
          color: var(--success);
          border: 1px solid rgba(16, 185, 129, 0.25);
        }
        .low-stock {
          background: rgba(245, 158, 11, 0.12);
          color: #f59e0b;
          border: 1px solid rgba(245, 158, 11, 0.25);
        }
        .out-of-stock {
          background: rgba(239, 68, 68, 0.12);
          color: var(--error);
          border: 1px solid rgba(239, 68, 68, 0.25);
        }
        .tags-row {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          margin-bottom: 14px;
        }
        .tag-pill {
          font-size: 10px;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 20px;
          background: rgba(139, 92, 246, 0.12);
          color: var(--accent);
          border: 1px solid rgba(139, 92, 246, 0.25);
        }
        .card-footer {
          margin-top: auto;
        }
        .add-to-cart-btn {
          width: 100%;
          background: linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%);
          color: white;
          border: none;
          padding: 12px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s;
        }
        .add-to-cart-btn.added {
          background: linear-gradient(135deg, var(--success) 0%, #059669 100%);
        }
        .add-to-cart-btn:hover:not(:disabled) {
          box-shadow: 0 8px 24px rgba(139, 92, 246, 0.4);
          transform: translateY(-2px);
        }
        .add-to-cart-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }
        .btn-inner {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
      `}</style>
    </motion.div>
  );
}
