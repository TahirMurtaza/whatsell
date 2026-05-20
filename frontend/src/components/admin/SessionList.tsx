'use client';
import { MessageSquare, Phone } from 'lucide-react';

interface Session {
  session_id: string;
  customer_phone: string;
  source: string;
  state: string;
  message_count: number;
  updated_at: string | null;
}

export default function SessionList({
  sessions,
  selected,
  onSelect,
}: {
  sessions: Session[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  if (!sessions.length) {
    return (
      <div style={{ padding: '24px', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
        No sessions found.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {sessions.map((s) => {
        const isActive = s.session_id === selected;
        return (
          <button
            key={s.session_id}
            onClick={() => onSelect(s.session_id)}
            style={{
              width: '100%', textAlign: 'left', padding: '12px 16px',
              background: isActive ? 'rgba(255,255,255,0.07)' : 'transparent',
              border: 'none', borderBottom: '1px solid rgba(255,255,255,0.05)',
              borderLeft: isActive ? '3px solid var(--primary)' : '3px solid transparent',
              cursor: 'pointer', color: '#fff', transition: 'background 0.15s',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Phone size={13} style={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>
                  {s.customer_phone || 'Unknown'}
                </span>
              </div>
              <span style={{
                fontSize: 10, padding: '1px 6px', borderRadius: 4,
                background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.4)',
              }}>
                {s.source}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                <MessageSquare size={11} />
                {s.message_count} messages
              </span>
              {s.updated_at && (
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>
                  {new Date(s.updated_at).toLocaleDateString()}
                </span>
              )}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {s.session_id}
            </div>
          </button>
        );
      })}
    </div>
  );
}
