'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { FileText, Trash2, Loader2, CheckCircle, XCircle, Clock } from 'lucide-react';

interface Doc {
  id: number;
  filename: string;
  status: 'pending' | 'processing' | 'ready' | 'error';
  error_msg?: string | null;
  created_at?: string | null;
}

interface DocumentListProps {
  sessionId: string;
  refreshTrigger: number;
  onCountChange?: (count: number) => void;
}

const STATUS_META: Record<string, { label: string; color: string; Icon: React.FC<any> }> = {
  pending:    { label: 'Pending',    color: '#f59e0b', Icon: Clock },
  processing: { label: 'Processing', color: '#60a5fa', Icon: Loader2 },
  ready:      { label: 'Ready',      color: '#10b981', Icon: CheckCircle },
  error:      { label: 'Error',      color: '#ef4444', Icon: XCircle },
};

export default function DocumentList({ sessionId, refreshTrigger, onCountChange }: DocumentListProps) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [deleting, setDeleting] = useState<number | null>(null);

  const fetchDocs = useCallback(async () => {
    try {
      const res = await fetch(`/api/documents/?session_id=${encodeURIComponent(sessionId)}`);
      if (res.ok) {
        const data = await res.json();
        const fetched = data.documents || [];
        setDocs(fetched);
        onCountChange?.(fetched.filter((d: Doc) => d.status === 'ready').length);
      }
    } catch {
      // silently ignore
    }
  }, [sessionId, onCountChange]);

  // Auto-poll while any doc is still processing/pending
  useEffect(() => {
    fetchDocs();
    const hasBusy = docs.some((d) => d.status === 'pending' || d.status === 'processing');
    if (!hasBusy) return;
    const id = setInterval(fetchDocs, 2500);
    return () => clearInterval(id);
  }, [fetchDocs, refreshTrigger, docs.map((d) => d.status).join(',')]);

  const handleDelete = async (docId: number) => {
    setDeleting(docId);
    try {
      await fetch(`/api/documents/${docId}?session_id=${encodeURIComponent(sessionId)}`, {
        method: 'DELETE',
      });
      // Remove from local state first for instant feedback, then re-fetch to sync count
      setDocs((prev) => prev.filter((d) => d.id !== docId));
      await fetchDocs();
    } finally {
      setDeleting(null);
    }
  };

  if (docs.length === 0) {
    return (
      <div className="empty">
        <FileText size={32} opacity={0.3} />
        <p>No documents yet. Upload one above.</p>
        <style jsx>{`
          .empty {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 8px;
            padding: 24px 16px;
            color: rgba(255,255,255,0.35);
            font-size: 13px;
            text-align: center;
          }
        `}</style>
      </div>
    );
  }

  return (
    <ul className="doc-list">
      {docs.map((doc) => {
        const meta = STATUS_META[doc.status] ?? STATUS_META.pending;
        const { Icon } = meta;
        const isSpinning = doc.status === 'processing';
        return (
          <li key={doc.id} className="doc-item">
            <FileText size={16} className="file-icon" />
            <div className="doc-info">
              <span className="doc-name" title={doc.filename}>{doc.filename}</span>
              {doc.error_msg && (
                <span className="doc-error" title={doc.error_msg}>{doc.error_msg}</span>
              )}
            </div>
            <span className="status-badge" style={{ color: meta.color, borderColor: meta.color }}>
              <Icon size={12} className={isSpinning ? 'spin' : ''} />
              {meta.label}
            </span>
            <button
              className="delete-btn"
              onClick={() => handleDelete(doc.id)}
              disabled={deleting === doc.id}
              title="Remove document"
            >
              {deleting === doc.id ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />}
            </button>
          </li>
        );
      })}

      <style jsx>{`
        .doc-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .doc-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          border-radius: 12px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
        }
        :global(.file-icon) {
          color: rgba(255,255,255,0.4);
          flex-shrink: 0;
        }
        .doc-info {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .doc-name {
          font-size: 13px;
          color: rgba(255,255,255,0.8);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .doc-error {
          font-size: 11px;
          color: #ef4444;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .status-badge {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          font-weight: 600;
          padding: 3px 8px;
          border-radius: 20px;
          border: 1px solid;
          white-space: nowrap;
          flex-shrink: 0;
          background: rgba(0,0,0,0.15);
        }
        .delete-btn {
          background: none;
          border: none;
          color: rgba(255,255,255,0.25);
          cursor: pointer;
          padding: 4px;
          border-radius: 6px;
          display: flex;
          transition: color 0.2s;
          flex-shrink: 0;
        }
        .delete-btn:hover:not(:disabled) {
          color: #ef4444;
        }
        .delete-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        :global(.spin) {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </ul>
  );
}
