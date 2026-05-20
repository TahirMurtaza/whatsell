'use client';
import { useState, useEffect, useCallback } from 'react';
import { LayoutDashboard, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import SessionList from '@/components/admin/SessionList';
import ConversationViewer from '@/components/admin/ConversationViewer';
import TokenUsageTab from '@/components/admin/TokenUsageTab';
import ToolCallInspector from '@/components/admin/ToolCallInspector';
import AnalyticsTab from '@/components/admin/AnalyticsTab';

const TABS = [
  { id: 'conversation', label: 'Conversation' },
  { id: 'tokens',       label: 'Token Usage' },
  { id: 'tools',        label: 'Tool Calls' },
  { id: 'analytics',    label: 'Analytics' },
] as const;
type TabId = typeof TABS[number]['id'];

export default function AdminPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [sessionDetail, setSessionDetail] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('conversation');
  const [analytics, setAnalytics] = useState<any | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Load sessions list
  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const qs = searchQuery ? `?search=${encodeURIComponent(searchQuery)}` : '';
      const res = await fetch(`/api/admin/sessions${qs}`);
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch (e) {
      console.error('Failed to load sessions', e);
    } finally {
      setSessionsLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  // Load session detail when selected
  const handleSelectSession = useCallback(async (sessionId: string) => {
    setSelectedSession(sessionId);
    setActiveTab('conversation');
    setDetailLoading(true);
    setSessionDetail(null);
    try {
      const res = await fetch(`/api/admin/sessions/${encodeURIComponent(sessionId)}`);
      const data = await res.json();
      setSessionDetail(data);
    } catch (e) {
      console.error('Failed to load session detail', e);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // Load analytics lazily when Analytics tab is opened
  useEffect(() => {
    if (activeTab === 'analytics' && !analytics && !analyticsLoading) {
      setAnalyticsLoading(true);
      fetch('/api/admin/analytics')
        .then(r => r.json())
        .then(d => { setAnalytics(d); setAnalyticsLoading(false); })
        .catch(() => setAnalyticsLoading(false));
    }
  }, [activeTab, analytics, analyticsLoading]);

  const messages = sessionDetail?.messages ?? [];
  const stats = sessionDetail?.stats ?? {
    message_count: 0, total_tokens: 0, total_prompt_tokens: 0,
    total_completion_tokens: 0, avg_response_time_ms: 0,
  };

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: var(--bg, #0f0f13); color: #fff; font-family: system-ui, sans-serif; }
        :root {
          --bg: #0f0f13;
          --card-bg: rgba(255,255,255,0.04);
          --primary: #7c3aed;
          --accent: #6366f1;
          --sidebar-w: 300px;
        }
        .tab-btn {
          background: transparent; border: none; cursor: pointer; color: rgba(255,255,255,0.5);
          padding: 8px 14px; font-size: 13px; border-bottom: 2px solid transparent;
          transition: color 0.15s, border-color 0.15s; white-space: nowrap;
        }
        .tab-btn.active { color: #fff; border-bottom-color: var(--primary); }
        .tab-btn:hover:not(.active) { color: rgba(255,255,255,0.8); }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 4px; }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)' }}>
        {/* Header */}
        <header style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px',
          height: 52, borderBottom: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(255,255,255,0.02)', flexShrink: 0,
        }}>
          <LayoutDashboard size={18} style={{ color: 'var(--primary)' }} />
          <span style={{ fontWeight: 700, fontSize: 15 }}>Admin Dashboard</span>
          <div style={{ flex: 1 }} />
          <Link href="/logs" style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>
            Logs
          </Link>
          <Link href="/" style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>
            ← Chat
          </Link>
        </header>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Sidebar */}
          <aside style={{
            width: 'var(--sidebar-w)', flexShrink: 0,
            borderRight: '1px solid rgba(255,255,255,0.08)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>
            {/* Search + refresh */}
            <div style={{
              padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', gap: 8,
            }}>
              <input
                placeholder="Search by phone…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && loadSessions()}
                style={{
                  flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 7, padding: '6px 10px', fontSize: 12, color: '#fff', outline: 'none',
                }}
              />
              <button
                onClick={loadSessions}
                style={{
                  background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 7, padding: '6px 8px', cursor: 'pointer', color: '#fff',
                  display: 'flex', alignItems: 'center',
                }}
              >
                <RefreshCw size={13} style={sessionsLoading ? { animation: 'spin 1s linear infinite' } : {}} />
              </button>
            </div>

            <div style={{ overflowY: 'auto', flex: 1 }}>
              {sessionsLoading ? (
                <p style={{ padding: '20px 16px', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Loading…</p>
              ) : (
                <SessionList
                  sessions={sessions}
                  selected={selectedSession}
                  onSelect={handleSelectSession}
                />
              )}
            </div>
          </aside>

          {/* Main panel */}
          <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {!selectedSession ? (
              <div style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'rgba(255,255,255,0.2)', fontSize: 15,
              }}>
                Select a session to inspect
              </div>
            ) : (
              <>
                {/* Session header */}
                {sessionDetail && (
                  <div style={{
                    padding: '10px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)',
                    display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0,
                    background: 'rgba(255,255,255,0.01)',
                  }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>
                      {sessionDetail.conversation.customer_phone || 'Unknown'}
                    </span>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
                      {sessionDetail.conversation.session_id}
                    </span>
                    <span style={{
                      fontSize: 11, padding: '2px 8px', borderRadius: 4,
                      background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.4)',
                    }}>
                      {sessionDetail.conversation.state}
                    </span>
                    <span style={{ marginLeft: 'auto', fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
                      {stats.message_count} messages · {stats.total_tokens.toLocaleString()} tokens
                    </span>
                  </div>
                )}

                {/* Tabs */}
                <div style={{
                  display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)',
                  paddingLeft: 8, flexShrink: 0, overflowX: 'auto',
                }}>
                  {TABS.map(t => (
                    <button
                      key={t.id}
                      className={`tab-btn${activeTab === t.id ? ' active' : ''}`}
                      onClick={() => setActiveTab(t.id)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Tab content */}
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  {detailLoading ? (
                    <p style={{ padding: '24px', color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>Loading session…</p>
                  ) : (
                    <>
                      {activeTab === 'conversation' && <ConversationViewer messages={messages} />}
                      {activeTab === 'tokens'       && <TokenUsageTab messages={messages} stats={stats} />}
                      {activeTab === 'tools'        && <ToolCallInspector messages={messages} />}
                      {activeTab === 'analytics'    && (
                        <AnalyticsTab stats={stats} analytics={analytics} analyticsLoading={analyticsLoading} />
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </main>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}
