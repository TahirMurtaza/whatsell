'use client';
import { useState } from 'react';
import { ExternalLink } from 'lucide-react';

interface Message {
  id: string;
  role: string;
  timestamp: string | null;
  metadata: { trace_id?: string; trace_url?: string; [key: string]: any };
}

export default function TraceViewTab({ messages }: { messages: Message[] }) {
  const traceTurns = messages
    .filter((m) => m.role === 'assistant' && m.metadata?.trace_url)
    .map((m, i) => ({
      label: `Turn ${i + 1}${m.timestamp ? ' — ' + new Date(m.timestamp).toLocaleTimeString() : ''}`,
      url: m.metadata.trace_url!,
      traceId: m.metadata.trace_id,
    }));

  const [selected, setSelected] = useState(0);

  if (!traceTurns.length) {
    return (
      <div style={{ padding: '24px', color: 'rgba(255,255,255,0.4)' }}>
        <p>No Langfuse traces yet.</p>
        <p style={{ fontSize: 13, marginTop: 8 }}>
          Traces are captured on new messages once Langfuse is running at{' '}
          <a href="http://localhost:3001" target="_blank" rel="noreferrer"
            style={{ color: 'var(--primary)' }}>localhost:3001</a>.
        </p>
      </div>
    );
  }

  const current = traceTurns[selected];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '12px' }}>
      {/* Turn selector + open link */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
        <select
          value={selected}
          onChange={(e) => setSelected(Number(e.target.value))}
          style={{
            background: 'var(--card-bg)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 8, padding: '6px 10px', fontSize: 13, flex: 1,
          }}
        >
          {traceTurns.map((t, i) => (
            <option key={i} value={i}>{t.label}</option>
          ))}
        </select>
        <a
          href={current.url}
          target="_blank"
          rel="noreferrer"
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
            background: 'var(--primary)', borderRadius: 8, fontSize: 13, color: '#fff',
            textDecoration: 'none', whiteSpace: 'nowrap',
          }}
        >
          <ExternalLink size={14} /> Open in Langfuse
        </a>
      </div>

      {/* iframe */}
      <iframe
        key={current.url}
        src={current.url}
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        style={{
          flex: 1,
          minHeight: 500,
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 10,
          background: '#111',
          width: '100%',
        }}
        title="Langfuse Trace"
      />
      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 6, textAlign: 'center' }}>
        Trace ID: {current.traceId ?? '—'}
      </p>
    </div>
  );
}
