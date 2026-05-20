'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  RefreshCw, Download, MessageSquare, Phone,
  ChevronLeft, ChevronRight, Search, X,
  MessageCircle, AlertCircle,
} from 'lucide-react';
import Link from 'next/link';
import SessionDrawer from '@/components/logs/SessionDrawer';

/* ─── Types ─────────────────────────────────────────────────────────────── */
interface Session {
  session_id: string;
  customer_phone: string;
  source: string;
  state: string;
  message_count: number;
  created_at: string | null;
  updated_at: string | null;
}

type Tab = 'sessions' | 'messages' | 'webhooks' | 'api';
type TimeRange = '1h' | '24h' | '7d' | '30d' | 'all';

/* ─── Helpers ────────────────────────────────────────────────────────────── */
// MongoDB timestamps lack 'Z' — always parse as UTC
const parseUTC = (iso: string | null): Date | null =>
  iso ? new Date(iso.endsWith('Z') ? iso : iso + 'Z') : null;

function fmtTime(iso: string | null): string {
  const d = parseUTC(iso);
  if (!d) return '—';
  return d.toLocaleString('en-US', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).replace(',', '');
}

function fmtDuration(created: string | null, updated: string | null): string {
  const c = parseUTC(created);
  const u = parseUTC(updated);
  if (!c || !u) return '—';
  const ms = u.getTime() - c.getTime();
  if (ms < 0) return '—';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function truncateId(id: string, len = 10): string {
  return id.length > len ? id.slice(0, len) + '…' : id;
}

function StateChip({ state }: { state: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    browsing:  { bg: 'rgba(99,102,241,0.15)',  color: '#818cf8', label: 'Browsing' },
    cart:      { bg: 'rgba(245,158,11,0.15)',  color: '#fbbf24', label: 'Cart' },
    checkout:  { bg: 'rgba(16,185,129,0.15)',  color: '#34d399', label: 'Checkout' },
    ordered:   { bg: 'rgba(16,185,129,0.15)',  color: '#34d399', label: 'Ordered' },
    idle:      { bg: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.4)', label: 'Idle' },
  };
  const s = map[state?.toLowerCase()] ?? { bg: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.4)', label: state || '—' };
  return (
    <span style={{
      fontSize: 11, padding: '2px 8px', borderRadius: 20,
      background: s.bg, color: s.color, fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      {s.label}
    </span>
  );
}

function SourceChip({ source }: { source: string }) {
  const isWA = source?.toLowerCase().includes('whatsapp') || source?.toLowerCase().includes('wa');
  const isWeb = source?.toLowerCase().includes('web');
  const bg = isWA ? 'rgba(37,211,102,0.12)' : isWeb ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.07)';
  const color = isWA ? '#25d366' : isWeb ? '#818cf8' : 'rgba(255,255,255,0.5)';
  const label = isWA ? 'WhatsApp' : isWeb ? 'Web' : (source || 'Unknown');
  return (
    <span style={{
      fontSize: 11, padding: '2px 8px', borderRadius: 20,
      background: bg, color, fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}

/* ─── Filter pill ────────────────────────────────────────────────────────── */
function FilterSelect({
  label, value, options, onChange,
}: {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 7, padding: '5px 10px', fontSize: 12, color: value ? '#fff' : 'rgba(255,255,255,0.4)',
        cursor: 'pointer', outline: 'none', minWidth: 120,
      }}
    >
      <option value="">{label}</option>
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────────────── */
const ROWS_OPTIONS = [10, 25, 50, 100];

export default function LogsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('sessions');
  const [drawerSession, setDrawerSession] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Filters
  const [searchPhone, setSearchPhone] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  const [searchInput, setSearchInput] = useState('');

  const searchRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const skip = page * rowsPerPage;
      const qs = new URLSearchParams();
      qs.set('skip', String(skip));
      qs.set('limit', String(rowsPerPage));
      if (searchPhone) qs.set('search', searchPhone);

      const res = await fetch(`/api/admin/sessions?${qs}`);
      const data = await res.json();
      let rows: Session[] = data.sessions || [];

      // Client-side filter by state / source / time range
      if (stateFilter) rows = rows.filter(s => s.state?.toLowerCase() === stateFilter.toLowerCase());
      if (sourceFilter) {
        rows = rows.filter(s => {
          const src = s.source?.toLowerCase() ?? '';
          if (sourceFilter === 'whatsapp') return src.includes('whatsapp') || src.includes('wa') || src === 'whatsapp';
          if (sourceFilter === 'web') return src.includes('web');
          return true;
        });
      }
      if (timeRange !== 'all') {
        const cutoff = new Date();
        const hours = { '1h': 1, '24h': 24, '7d': 168, '30d': 720 }[timeRange] ?? 0;
        cutoff.setTime(cutoff.getTime() - hours * 3600 * 1000);
        rows = rows.filter(s => {
          // Prefer updated_at so recently-active sessions always surface
          const ts = parseUTC(s.updated_at) ?? parseUTC(s.created_at);
          return ts !== null && ts >= cutoff;
        });
      }

      setSessions(rows);
      setTotal(data.total ?? rows.length);
    } catch (e) {
      console.error('Failed to load sessions', e);
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, searchPhone, stateFilter, sourceFilter, timeRange]);

  useEffect(() => { load(); }, [load]);

  // Reset to page 0 when filters change
  useEffect(() => { setPage(0); }, [searchPhone, stateFilter, sourceFilter, timeRange, rowsPerPage]);

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') setSearchPhone(searchInput);
  };

  const totalPages = Math.ceil(total / rowsPerPage);

  const exportCsv = () => {
    const rows = [
      ['Session ID', 'Source', 'Customer Phone', 'State', 'Messages', 'Start Time', 'Duration'],
      ...sessions.map(s => [
        s.session_id, s.source, s.customer_phone, s.state,
        s.message_count, fmtTime(s.created_at), fmtDuration(s.created_at, s.updated_at),
      ]),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'whatsell-sessions.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0a0a0f; color: #fff; font-family: system-ui, -apple-system, sans-serif; }
        :root { --primary: #7c3aed; --accent: #6366f1; --bg: #0a0a0f; --surface: rgba(255,255,255,0.03); --border: rgba(255,255,255,0.08); }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 4px; }
        .tab-btn { background: transparent; border: none; cursor: pointer; color: rgba(255,255,255,0.45); padding: 10px 16px; font-size: 13px; font-weight: 500; border-bottom: 2px solid transparent; transition: color 0.15s, border-color 0.15s; white-space: nowrap; }
        .tab-btn.active { color: #fff; border-bottom-color: var(--primary); }
        .tab-btn:hover:not(.active) { color: rgba(255,255,255,0.75); }
        .row-btn { width: 100%; text-align: left; background: transparent; border: none; border-bottom: 1px solid rgba(255,255,255,0.04); color: #fff; cursor: pointer; display: table-row; transition: background 0.12s; }
        .row-btn:hover td { background: rgba(255,255,255,0.03); }
        .icon-btn { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 7px; padding: 6px 12px; cursor: pointer; color: rgba(255,255,255,0.7); font-size: 12px; display: flex; align-items: center; gap: 6px; transition: background 0.15s; }
        .icon-btn:hover { background: rgba(255,255,255,0.1); color: #fff; }
        .page-btn { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 5px 10px; cursor: pointer; color: rgba(255,255,255,0.6); display: flex; align-items: center; transition: background 0.15s; }
        .page-btn:hover:not(:disabled) { background: rgba(255,255,255,0.1); color: #fff; }
        .page-btn:disabled { opacity: 0.3; cursor: not-allowed; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)' }}>

        {/* ── Top bar ── */}
        <header style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px',
          height: 52, borderBottom: '1px solid var(--border)',
          background: 'rgba(255,255,255,0.02)', flexShrink: 0,
        }}>
          <span style={{ fontWeight: 700, fontSize: 17, letterSpacing: '-0.01em' }}>Logs</span>
          <div style={{ flex: 1 }} />
          <button className="icon-btn" onClick={load}>
            <RefreshCw size={13} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
            Refresh
          </button>
          <button className="icon-btn" onClick={exportCsv}>
            <Download size={13} />
            Export All
          </button>
          <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)' }} />
          <Link href="/admin" style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>
            ← Dashboard
          </Link>
          <Link href="/" style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>
            ← Chat
          </Link>
        </header>

        {/* ── Tabs ── */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', paddingLeft: 8, background: 'rgba(255,255,255,0.01)', flexShrink: 0 }}>
          {(['sessions', 'messages', 'webhooks', 'api'] as Tab[]).map(t => (
            <button
              key={t}
              className={`tab-btn${activeTab === t ? ' active' : ''}`}
              onClick={() => setActiveTab(t)}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {activeTab !== 'sessions' ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: 'rgba(255,255,255,0.2)' }}>
            <AlertCircle size={32} />
            <span style={{ fontSize: 14 }}>{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} logs coming soon</span>
          </div>
        ) : (
          <>
            {/* ── Filters ── */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px',
              borderBottom: '1px solid var(--border)', flexWrap: 'wrap', flexShrink: 0,
              background: 'rgba(255,255,255,0.01)',
            }}>
              {/* Time range */}
              <div style={{ display: 'flex', gap: 2, background: 'rgba(255,255,255,0.05)', borderRadius: 7, padding: 2 }}>
                {(['1h', '24h', '7d', '30d', 'all'] as TimeRange[]).map(t => (
                  <button
                    key={t}
                    onClick={() => setTimeRange(t)}
                    style={{
                      background: timeRange === t ? 'rgba(124,58,237,0.35)' : 'transparent',
                      border: timeRange === t ? '1px solid rgba(124,58,237,0.5)' : '1px solid transparent',
                      borderRadius: 5, padding: '4px 10px', cursor: 'pointer',
                      color: timeRange === t ? '#c4b5fd' : 'rgba(255,255,255,0.4)',
                      fontSize: 12, fontWeight: timeRange === t ? 600 : 400, transition: 'all 0.15s',
                    }}
                  >
                    {t === 'all' ? 'All time' : `Last ${t}`}
                  </button>
                ))}
              </div>

              {/* Phone search */}
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Search size={12} style={{ position: 'absolute', left: 9, color: 'rgba(255,255,255,0.3)', pointerEvents: 'none' }} />
                <input
                  ref={searchRef}
                  placeholder="Search phone…"
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  style={{
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 7, padding: '5px 10px 5px 28px', fontSize: 12, color: '#fff', outline: 'none',
                    width: 170,
                  }}
                />
                {searchInput && (
                  <button
                    onClick={() => { setSearchInput(''); setSearchPhone(''); }}
                    style={{ position: 'absolute', right: 7, background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', display: 'flex' }}
                  >
                    <X size={11} />
                  </button>
                )}
              </div>
              <button
                onClick={() => setSearchPhone(searchInput)}
                style={{
                  background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.4)',
                  borderRadius: 7, padding: '5px 12px', cursor: 'pointer', color: '#c4b5fd', fontSize: 12,
                }}
              >
                Search
              </button>

              <FilterSelect
                label="All Sources"
                value={sourceFilter}
                options={[
                  { label: 'WhatsApp', value: 'whatsapp' },
                  { label: 'Web', value: 'web' },
                ]}
                onChange={setSourceFilter}
              />

              <FilterSelect
                label="All States"
                value={stateFilter}
                options={[
                  { label: 'Browsing', value: 'browsing' },
                  { label: 'Cart', value: 'cart' },
                  { label: 'Checkout', value: 'checkout' },
                  { label: 'Ordered', value: 'ordered' },
                  { label: 'Idle', value: 'idle' },
                ]}
                onChange={setStateFilter}
              />

              {(sourceFilter || stateFilter || searchPhone) && (
                <button
                  onClick={() => { setSourceFilter(''); setStateFilter(''); setSearchPhone(''); setSearchInput(''); }}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'rgba(255,255,255,0.35)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4,
                  }}
                >
                  <X size={12} /> Clear filters
                </button>
              )}

              <div style={{ marginLeft: 'auto', fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
                {total.toLocaleString()} session{total !== 1 ? 's' : ''}
              </div>
            </div>

            {/* ── Table ── */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {loading ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>
                  <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite', marginBottom: 8 }} />
                  <br />Loading sessions…
                </div>
              ) : sessions.length === 0 ? (
                <div style={{ padding: 60, textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 14 }}>
                  No sessions found
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                      {['Session ID', 'Source', 'Customer Phone', 'Type', 'State', 'Start Time', 'Duration', 'Messages'].map(h => (
                        <th key={h} style={{
                          padding: '9px 14px', textAlign: 'left', fontWeight: 500,
                          fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.03em',
                          textTransform: 'uppercase', whiteSpace: 'nowrap',
                        }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map(s => (
                      <tr
                        key={s.session_id}
                        onClick={() => setDrawerSession(s.session_id)}
                        style={{ cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.1s' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        {/* Session ID */}
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ fontFamily: 'monospace', color: '#a78bfa', fontSize: 12 }}>
                            {truncateId(s.session_id, 12)}
                          </span>
                        </td>

                        {/* Source */}
                        <td style={{ padding: '10px 14px' }}>
                          <SourceChip source={s.source} />
                        </td>

                        {/* Customer Phone */}
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Phone size={11} style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0 }} />
                            <span style={{ color: 'rgba(255,255,255,0.85)' }}>
                              {s.customer_phone || <span style={{ color: 'rgba(255,255,255,0.25)' }}>Unknown</span>}
                            </span>
                          </div>
                        </td>

                        {/* Type */}
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            fontSize: 11, padding: '2px 8px', borderRadius: 20,
                            background: 'rgba(99,102,241,0.12)', color: '#818cf8', fontWeight: 600,
                          }}>
                            <MessageCircle size={10} />
                            Inbound
                          </span>
                        </td>

                        {/* State */}
                        <td style={{ padding: '10px 14px' }}>
                          <StateChip state={s.state} />
                        </td>

                        {/* Start Time */}
                        <td style={{ padding: '10px 14px', color: 'rgba(255,255,255,0.55)', whiteSpace: 'nowrap' }}>
                          {fmtTime(s.created_at)}
                        </td>

                        {/* Duration */}
                        <td style={{ padding: '10px 14px', color: 'rgba(255,255,255,0.55)', whiteSpace: 'nowrap' }}>
                          {fmtDuration(s.created_at, s.updated_at)}
                        </td>

                        {/* Messages */}
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'rgba(255,255,255,0.6)' }}>
                            <MessageSquare size={11} />
                            {s.message_count}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* ── Pagination ── */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 16px', borderTop: '1px solid var(--border)',
              background: 'rgba(255,255,255,0.01)', flexShrink: 0, flexWrap: 'wrap', gap: 8,
            }}>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
                {sessions.length === 0 ? 'No results' : `Page ${page + 1} of ${Math.max(totalPages, 1)}`}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button className="page-btn" onClick={() => setPage(p => Math.max(p - 1, 0))} disabled={page === 0}>
                  <ChevronLeft size={14} />
                </button>

                {/* Page number pills */}
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const p = Math.max(0, Math.min(page - 2, totalPages - 5)) + i;
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      style={{
                        background: p === page ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.05)',
                        border: `1px solid ${p === page ? 'rgba(124,58,237,0.5)' : 'rgba(255,255,255,0.09)'}`,
                        borderRadius: 6, padding: '4px 10px', cursor: 'pointer',
                        color: p === page ? '#c4b5fd' : 'rgba(255,255,255,0.5)',
                        fontSize: 12, fontWeight: p === page ? 600 : 400,
                      }}
                    >
                      {p + 1}
                    </button>
                  );
                })}

                <button className="page-btn" onClick={() => setPage(p => Math.min(p + 1, Math.max(totalPages - 1, 0)))} disabled={page >= totalPages - 1}>
                  <ChevronRight size={14} />
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                Rows per page
                <select
                  value={rowsPerPage}
                  onChange={e => setRowsPerPage(Number(e.target.value))}
                  style={{
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 6, padding: '4px 8px', color: '#fff', fontSize: 12, cursor: 'pointer', outline: 'none',
                  }}
                >
                  {ROWS_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Session Drawer ── */}
      <SessionDrawer
        sessionId={drawerSession}
        onClose={() => setDrawerSession(null)}
      />
    </>
  );
}
