'use client';

import React from 'react';
import { FileText } from 'lucide-react';

interface Source {
  filename: string;
  excerpt?: string;
}

interface SourceCardProps {
  sources: Source[];
}

export default function SourceCard({ sources }: SourceCardProps) {
  if (!sources || sources.length === 0) return null;

  // Deduplicate by filename
  const unique = sources.filter(
    (s, i, arr) => arr.findIndex((x) => x.filename === s.filename) === i
  );

  return (
    <div className="sources-block">
      <p className="sources-label">Sources</p>
      <div className="source-list">
        {unique.map((s, i) => (
          <div key={i} className="source-chip">
            <FileText size={12} />
            <span>{s.filename}</span>
          </div>
        ))}
      </div>

      <style jsx>{`
        .sources-block {
          margin-top: 8px;
        }
        .sources-label {
          font-size: 11px;
          font-weight: 600;
          color: rgba(255,255,255,0.35);
          letter-spacing: 0.05em;
          text-transform: uppercase;
          margin-bottom: 6px;
        }
        .source-list {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .source-chip {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 4px 10px;
          border-radius: 20px;
          background: rgba(139,92,246,0.1);
          border: 1px solid rgba(139,92,246,0.25);
          color: rgba(255,255,255,0.6);
          font-size: 12px;
          font-weight: 500;
        }
      `}</style>
    </div>
  );
}
