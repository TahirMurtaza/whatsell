'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
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
    <div className="admin-layout">
      <div className="admin-content">
        <div className="content-grid">
          {/* Sessions Sidebar */}
          <div className="sessions-panel">
            <div className="panel-header">
              <h3>Sessions</h3>
              <button onClick={loadSessions} className="refresh-btn" title="Refresh">
                <RefreshCw size={14} style={sessionsLoading ? { animation: 'spin 1s linear infinite' } : {}} />
              </button>
            </div>
            <div className="search-box">
              <input
                placeholder="Search by phone..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && loadSessions()}
              />
            </div>
            <div className="sessions-list">
              {sessionsLoading ? (
                <p className="empty-state">Loading...</p>
              ) : (
                <SessionList
                  sessions={sessions}
                  selected={selectedSession}
                  onSelect={handleSelectSession}
                />
              )}
            </div>
          </div>

          {/* Main Panel */}
          <div className="main-panel">
            {!selectedSession ? (
              <div className="empty-state">
                <p>Select a session to inspect</p>
              </div>
            ) : (
              <>
                {sessionDetail && (
                  <div className="session-header">
                    <span className="session-phone">{sessionDetail.conversation.customer_phone || 'Unknown'}</span>
                    <span className="session-id">{sessionDetail.conversation.session_id}</span>
                    <span className="session-state">{sessionDetail.conversation.state}</span>
                    <span className="session-stats">
                      {stats.message_count} messages · {stats.total_tokens.toLocaleString()} tokens
                    </span>
                  </div>
                )}

                <div className="tabs-bar">
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

                <div className="tab-content">
                  {detailLoading ? (
                    <p className="empty-state">Loading session...</p>
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
          </div>
        </div>
      </div>

      <style jsx>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .admin-layout {
          display: flex;
          height: 100vh;
          background: #0f0f13;
          overflow: hidden;
        }
        .admin-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .content-grid {
          display: flex;
          flex: 1;
          overflow: hidden;
        }
        .sessions-panel {
          width: 300px;
          border-right: 1px solid rgba(255, 255, 255, 0.06);
          display: flex;
          flex-direction: column;
          flex-shrink: 0;
          background: rgba(255, 255, 255, 0.01);
        }
        .panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }
        .panel-header h3 {
          font-size: 14px;
          font-weight: 600;
        }
        .refresh-btn {
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 6px;
          padding: 5px;
          cursor: pointer;
          color: rgba(255, 255, 255, 0.5);
          display: flex;
          align-items: center;
        }
        .refresh-btn:hover {
          color: #fff;
          background: rgba(255, 255, 255, 0.1);
        }
        .search-box {
          padding: 8px 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        }
        .search-box input {
          width: 100%;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 6px;
          padding: 6px 10px;
          font-size: 12px;
          color: #fff;
          outline: none;
        }
        .sessions-list {
          flex: 1;
          overflow-y: auto;
        }
        .main-panel {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .session-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          background: rgba(255, 255, 255, 0.01);
          flex-shrink: 0;
        }
        .session-phone {
          font-size: 13px;
          font-weight: 600;
        }
        .session-id {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.35);
        }
        .session-state {
          font-size: 11px;
          padding: 2px 8px;
          border-radius: 4px;
          background: rgba(255, 255, 255, 0.07);
          color: rgba(255, 255, 255, 0.4);
        }
        .session-stats {
          margin-left: auto;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.35);
        }
        .tabs-bar {
          display: flex;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          padding-left: 8px;
          flex-shrink: 0;
          overflow-x: auto;
        }
        .tab-btn {
          background: transparent;
          border: none;
          cursor: pointer;
          color: rgba(255, 255, 255, 0.4);
          padding: 10px 14px;
          font-size: 13px;
          border-bottom: 2px solid transparent;
          transition: color 0.15s, border-color 0.15s;
          white-space: nowrap;
        }
        .tab-btn.active {
          color: #fff;
          border-bottom-color: var(--primary);
        }
        .tab-btn:hover:not(.active) {
          color: rgba(255, 255, 255, 0.7);
        }
        .tab-content {
          flex: 1;
          overflow-y: auto;
          padding: 0;
        }
        .empty-state {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          color: rgba(255, 255, 255, 0.2);
          font-size: 14px;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
