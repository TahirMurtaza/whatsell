'use client';

import React, { useRef, useState } from 'react';
import { Upload, FileText, Loader2 } from 'lucide-react';

interface DocumentUploadProps {
  sessionId: string;
  onUploaded: () => void; // callback to refresh document list
}

const ACCEPTED_TYPES = '.txt,.pdf,.docx';

export default function DocumentUpload({ sessionId, onUploaded }: DocumentUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadFile = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('session_id', sessionId);

      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || `Upload failed (${res.status})`);
      }

      onUploaded();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    uploadFile(files[0]);
  };

  return (
    <div>
      <div
        className={`drop-zone ${dragging ? 'active' : ''} ${uploading ? 'busy' : ''}`}
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          style={{ display: 'none' }}
          onChange={(e) => handleFiles(e.target.files)}
        />

        <div className="drop-content">
          {uploading ? (
            <>
              <Loader2 size={28} className="spin" />
              <span>Uploading...</span>
            </>
          ) : (
            <>
              <Upload size={28} />
              <span>Drop a file here or click to browse</span>
              <small>.txt · .pdf · .docx — max 10 MB</small>
            </>
          )}
        </div>
      </div>

      {error && <p className="upload-error">{error}</p>}

      <style jsx>{`
        .drop-zone {
          border: 2px dashed rgba(139, 92, 246, 0.35);
          border-radius: 16px;
          padding: 28px 20px;
          text-align: center;
          cursor: pointer;
          transition: border-color 0.2s, background 0.2s;
          background: rgba(139, 92, 246, 0.04);
        }
        .drop-zone.active,
        .drop-zone:hover:not(.busy) {
          border-color: rgba(139, 92, 246, 0.7);
          background: rgba(139, 92, 246, 0.1);
        }
        .drop-zone.busy {
          cursor: default;
          opacity: 0.7;
        }
        .drop-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          color: rgba(255, 255, 255, 0.65);
          font-size: 14px;
        }
        .drop-content small {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.35);
        }
        :global(.spin) {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .upload-error {
          margin-top: 8px;
          font-size: 13px;
          color: #ef4444;
          text-align: center;
        }
      `}</style>
    </div>
  );
}
