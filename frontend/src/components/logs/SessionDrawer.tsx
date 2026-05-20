'use client';
import { useEffect, useRef, useState } from 'react';
import {
  X, Copy, Check, Phone, MessageSquare, Clock, Zap,
  ChevronDown, ChevronRight, Wrench, Bot, User, BarChart2,
} from 'lucide-react';

/* ─── Types ─────────────────────────────────────────────────────────────── */
interface ToolCall { tool: string; input: string; output: string; }
interface TokenCounts { prompt_tokens: number; completion_tokens: number; total_tokens: number; }
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string | null;
  metadata: { type?: string; tool_calls?: ToolCall[]; token_counts?: TokenCounts; [k: string]: any };
}
interface Stats {
  message_count: number;
  total_tokens: number;
  total_prompt_tokens: number;
  total_completion_tokens: number;
  avg_response_time_ms: number;
}
interface SessionDetail {
  conversation: {
    session_id: string;
    customer_phone: string;
    source: string;
    state: string;
    created_at: string | null;
    updated_at: string | null;
  };
  messages: Message[];
  stats: Stats;
}

type DrawerTab = 'transcript' | 'tools' | 'tokens' | 'analytics';

/* ─── Tiny helpers ───────────────────────────────────────────────────────── */
function fmtDuration(created: string | null, updated: string | null) {
  if (!created || !updated) return '—';
  const ms = new Date(updated).getTime() - new Date(created).getTime();
  if (ms <= 0) return '—';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}m ${s % 60}s` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

function fmtTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
}

function tryJson(s: string) {
  try { return JSON.stringify(JSON.parse(s), null, 2); } catch { return s; }
}

/* ─── Copy button ────────────────────────────────────────────────────────── */
function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button onClick={copy} style={btnStyle}>
      {copied ? <Check size={11} style={{ color: '#34d399' }} /> : <Copy size={11} />}
    </button>
  );
}
const btnStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 5, padding: '3px 6px', cursor: 'pointer', color: 'rgba(255,255,255,0.5)',
  display: 'flex', alignItems: 'center',
};

/* ─── State badge ────────────────────────────────────────────────────────── */
function StateBadge({ state }: { state: string }) {
  const map: Record<string, [string, string]> = {
    browsing: ['rgba(99,102,241,0.2)', '#818cf8'],
    cart:     ['rgba(245,158,11,0.2)', '#fbbf24'],
    checkout: ['rgba(16,185,129,0.2)', '#34d399'],
    ordered:  ['rgba(16,185,129,0.2)', '#34d399'],
    idle:     ['rgba(255,255,255,0.07)', 'rgba(255,255,255,0.4)'],
  };
  const [bg, color] = map[state?.toLowerCase()] ?? ['rgba(255,255,255,0.07)', 'rgba(255,255,255,0.4)'];
  return (
    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: bg, color, fontWeight: 600 }}>
      {state || '—'}
    </span>
  );
}

/* ─── Tab: Transcript ────────────────────────────────────────────────────── */
function Transcript({ messages }: { messages: Message[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  if (!messages.length) return <Empty text="No messages in this session." />;

  return (
    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {messages.map((m) => {
        const isUser = m.role === 'user';
        return (
          <div key={m.id} style={{ display: 'flex', flexDirection: isUser ? 'row-reverse' : 'row', gap: 10, alignItems: 'flex-start' }}>
            {/* Avatar */}
            <div style={{
              width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
              background: isUser ? '#7c3aed' : 'rgba(255,255,255,0.09)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {isUser ? <User size={14} color="#fff" /> : <Bot size={14} color="rgba(255,255,255,0.6)" />}
            </div>

            {/* Bubble */}
            <div style={{ maxWidth: '78%' }}>
              <div style={{
                background: isUser ? '#7c3aed' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${isUser ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: isUser ? '14px 3px 14px 14px' : '3px 14px 14px 14px',
                padding: '10px 14px', fontSize: 13, lineHeight: 1.55,
                whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#fff',
              }}>
                {m.content}
              </div>
              <div style={{
                display: 'flex', gap: 8, marginTop: 4, alignItems: 'center',
                flexDirection: isUser ? 'row-reverse' : 'row',
              }}>
                {m.timestamp && (
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)' }}>
                    {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                )}
                {m.metadata?.type === 'product' && (
                  <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)' }}>
                    product
                  </span>
                )}
                {m.metadata?.tool_calls?.length ? (
                  <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.2)' }}>
                    {m.metadata.tool_calls.length} tool{m.metadata.tool_calls.length !== 1 ? 's' : ''}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}

/* ─── Tab: Tool Calls ────────────────────────────────────────────────────── */
function ToolCalls({ messages }: { messages: Message[] }) {
  const [openTurn, setOpenTurn] = useState<string | null>(null);
  const [openOut, setOpenOut] = useState<Record<string, boolean>>({});

  const turns = messages
    .filter(m => m.role === 'assistant' && (m.metadata?.tool_calls?.length ?? 0) > 0)
    .map((m, i) => ({ idx: i + 1, ...m }));

  if (!turns.length) return <Empty text="No tool calls recorded in this session." />;

  return (
    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {turns.map(turn => {
        const open = openTurn === turn.id;
        const calls = turn.metadata.tool_calls!;
        return (
          <div key={turn.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, overflow: 'hidden' }}>
            <button
              onClick={() => setOpenTurn(open ? null : turn.id)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#fff', textAlign: 'left' }}
            >
              {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <Wrench size={13} style={{ color: '#7c3aed' }} />
              <span style={{ fontSize: 13, fontWeight: 600 }}>Turn {turn.idx}</span>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{calls.length} call{calls.length !== 1 ? 's' : ''}</span>
              {turn.timestamp && (
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'rgba(255,255,255,0.28)' }}>
                  {new Date(turn.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </button>

            {open && (
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                {calls.map((call, ci) => {
                  const key = `${turn.id}-${ci}`;
                  const outExpanded = openOut[key];
                  const lines = call.output.split('\n');
                  const truncated = !outExpanded && lines.length > 15;
                  return (
                    <div key={ci} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <span style={{ alignSelf: 'flex-start', fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 6, background: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.25)' }}>
                        {call.tool}
                      </span>
                      <SectionLabel>Input</SectionLabel>
                      <CodeBlock>{tryJson(call.input)}</CodeBlock>
                      <SectionLabel>Output</SectionLabel>
                      <CodeBlock dim>{tryJson(truncated ? lines.slice(0, 15).join('\n') + '\n…' : call.output)}</CodeBlock>
                      {lines.length > 15 && (
                        <button onClick={() => setOpenOut(p => ({ ...p, [key]: !outExpanded }))}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7c3aed', fontSize: 12, padding: 0, textAlign: 'left' }}>
                          {outExpanded ? 'Show less' : `Show all ${lines.length} lines`}
                        </button>
                      )}
                      {ci < calls.length - 1 && <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.05)' }} />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Tab: Token Usage ───────────────────────────────────────────────────── */
function TokenUsage({ messages, stats }: { messages: Message[]; stats: Stats }) {
  const turns = messages
    .filter(m => m.role === 'assistant' && m.metadata?.token_counts?.total_tokens)
    .map((m, i) => ({ turn: i + 1, ...m.metadata.token_counts!, ts: m.timestamp }));

  const maxTotal = Math.max(...turns.map(t => t.total_tokens), 1);

  if (!turns.length) return <Empty text="No token data recorded yet." />;

  return (
    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Summary cards */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {[
          { label: 'Total Tokens', v: stats.total_tokens },
          { label: 'Prompt', v: stats.total_prompt_tokens },
          { label: 'Completion', v: stats.total_completion_tokens },
        ].map(({ label, v }) => (
          <div key={label} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '12px 18px', flex: '1 1 100px' }}>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{v.toLocaleString()}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              {['Turn', 'Time', 'Prompt', 'Completion', 'Total', 'Bar'].map(h => (
                <th key={h} style={{ padding: '7px 10px', textAlign: 'left', color: 'rgba(255,255,255,0.4)', fontWeight: 500, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {turns.map(t => (
              <tr key={t.turn} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <td style={{ padding: '7px 10px' }}>#{t.turn}</td>
                <td style={{ padding: '7px 10px', color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>{t.ts ? new Date(t.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                <td style={{ padding: '7px 10px' }}>{t.prompt_tokens.toLocaleString()}</td>
                <td style={{ padding: '7px 10px' }}>{t.completion_tokens.toLocaleString()}</td>
                <td style={{ padding: '7px 10px', fontWeight: 600 }}>{t.total_tokens.toLocaleString()}</td>
                <td style={{ padding: '7px 10px', minWidth: 100 }}>
                  <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', background: 'rgba(255,255,255,0.07)' }}>
                    <div style={{ width: `${(t.prompt_tokens / maxTotal) * 100}%`, background: '#7c3aed' }} />
                    <div style={{ width: `${(t.completion_tokens / maxTotal) * 100}%`, background: '#6366f1' }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', gap: 14, fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
        {[['#7c3aed', 'Prompt'], ['#6366f1', 'Completion']].map(([c, l]) => (
          <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: c, display: 'inline-block' }} />{l}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ─── Tab: Analytics ─────────────────────────────────────────────────────── */
function Analytics({ stats }: { stats: Stats }) {
  const cards = [
    { icon: <MessageSquare size={16} />, label: 'Messages', value: stats.message_count },
    { icon: <Zap size={16} />, label: 'Total Tokens', value: stats.total_tokens.toLocaleString() },
    { icon: <Clock size={16} />, label: 'Avg Response', value: stats.avg_response_time_ms > 0 ? `${(stats.avg_response_time_ms / 1000).toFixed(1)}s` : '—' },
    { icon: <BarChart2 size={16} />, label: 'Prompt Tokens', value: stats.total_prompt_tokens.toLocaleString() },
    { icon: <Zap size={16} />, label: 'Completion Tokens', value: stats.total_completion_tokens.toLocaleString() },
  ];
  return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h3 style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Session Analytics</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {cards.map(({ icon, label, value }) => (
          <div key={label} style={{ flex: '1 1 140px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ color: '#7c3aed' }}>{icon}</span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Small sub-components ───────────────────────────────────────────────── */
function Empty({ text }: { text: string }) {
  return <p style={{ padding: '32px 24px', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>{text}</p>;
}
function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{children}</div>;
}
function CodeBlock({ children, dim }: { children: React.ReactNode; dim?: boolean }) {
  return (
    <pre style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 6, padding: '8px 12px', fontSize: 11, overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0, color: dim ? '#94a3b8' : '#e2e8f0' }}>
      {children}
    </pre>
  );
}

/* ─── Main Drawer ────────────────────────────────────────────────────────── */
export default function SessionDrawer({
  sessionId,
  onClose,
}: {
  sessionId: string | null;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<DrawerTab>('transcript');

  const TABS: { id: DrawerTab; label: string }[] = [
    { id: 'transcript', label: 'Transcript' },
    { id: 'tools',      label: 'Tool Calls' },
    { id: 'tokens',     label: 'Token Usage' },
    { id: 'analytics',  label: 'Analytics' },
  ];

  // Fetch detail when sessionId changes
  useEffect(() => {
    if (!sessionId) { setDetail(null); return; }
    setLoading(true);
    setActiveTab('transcript');
    fetch(`/api/admin/sessions/${encodeURIComponent(sessionId)}`)
      .then(r => r.json())
      .then(d => setDetail(d))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [sessionId]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const open = !!sessionId;

  const messages = detail?.messages ?? [];
  const stats = detail?.stats ?? {
    message_count: 0, total_tokens: 0,
    total_prompt_tokens: 0, total_completion_tokens: 0, avg_response_time_ms: 0,
  };
  const conv = detail?.conversation;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
          zIndex: 40, opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 0.25s ease',
        }}
      />

      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 'min(720px, 100vw)',
        background: '#0d0d14',
        borderLeft: '1px solid rgba(255,255,255,0.09)',
        zIndex: 50,
        display: 'flex', flexDirection: 'column',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
        boxShadow: '-24px 0 80px rgba(0,0,0,0.6)',
      }}>

        {/* ── Drawer header ── */}
        <div style={{
          padding: '14px 20px 0',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          flexShrink: 0,
        }}>
          {/* Top row */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Date + source + state */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{fmtTime(conv?.created_at ?? null)}</span>
                <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 12, background: 'rgba(37,211,102,0.12)', color: '#25d366', fontWeight: 600 }}>
                  {conv?.source || 'WhatsApp'}
                </span>
                {conv?.state && <StateBadge state={conv.state} />}
              </div>

              {/* Phone */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Phone size={13} style={{ color: 'rgba(255,255,255,0.35)' }} />
                <span style={{ fontSize: 14, fontWeight: 600 }}>{conv?.customer_phone || 'Unknown'}</span>
                {conv?.customer_phone && <CopyBtn text={conv.customer_phone} />}
              </div>

              {/* Session ID */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5 }}>
                <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                  {conv?.session_id ?? '—'}
                </span>
                {conv?.session_id && <CopyBtn text={conv.session_id} />}
              </div>
            </div>

            {/* Meta pills + close */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                  <Zap size={11} style={{ display: 'inline', marginRight: 3 }} />
                  {stats.total_tokens.toLocaleString()} tokens
                </span>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                  <Clock size={11} style={{ display: 'inline', marginRight: 3 }} />
                  {fmtDuration(conv?.created_at ?? null, conv?.updated_at ?? null)}
                </span>
              </div>
              <button
                onClick={onClose}
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 7, padding: '7px', cursor: 'pointer', color: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', flexShrink: 0 }}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 0, overflowX: 'auto' }}>
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  padding: '8px 16px', fontSize: 13, fontWeight: 500,
                  color: activeTab === t.id ? '#fff' : 'rgba(255,255,255,0.4)',
                  borderBottom: `2px solid ${activeTab === t.id ? '#7c3aed' : 'transparent'}`,
                  transition: 'color 0.15s, border-color 0.15s', whiteSpace: 'nowrap',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Drawer body ── */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>
              Loading session…
            </div>
          ) : (
            <>
              {activeTab === 'transcript' && <Transcript messages={messages} />}
              {activeTab === 'tools'      && <ToolCalls messages={messages} />}
              {activeTab === 'tokens'     && <TokenUsage messages={messages} stats={stats} />}
              {activeTab === 'analytics'  && <Analytics stats={stats} />}
            </>
          )}
        </div>
      </div>
    </>
  );
}
