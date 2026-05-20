'use client';
import { BarChart2, MessageSquare, ShoppingBag, DollarSign, Users, Zap, Clock } from 'lucide-react';

interface SessionStats {
  message_count: number;
  total_tokens: number;
  avg_response_time_ms: number;
}

interface AnalyticsData {
  ecommerce: {
    total_orders: number;
    total_customers: number;
    total_products: number;
    total_revenue: number;
    orders_today: number;
    revenue_today: number;
  };
  conversations: {
    total_conversations: number;
    conversations_today: number;
    messages_today: number;
    total_tokens_used: number;
  };
}

function StatCard({
  icon, label, value, sub,
}: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string;
}) {
  return (
    <div style={{
      background: 'var(--card-bg)', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 10, padding: '14px 18px', minWidth: 140, flex: '1 1 140px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ color: 'var(--primary)' }}>{icon}</span>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      </div>
      <div style={{ fontSize: 24, fontWeight: 700 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export default function AnalyticsTab({
  stats,
  analytics,
  analyticsLoading,
}: {
  stats: SessionStats;
  analytics: AnalyticsData | null;
  analyticsLoading: boolean;
}) {
  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Session stats */}
      <div>
        <h3 style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
          This Session
        </h3>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <StatCard icon={<MessageSquare size={16} />} label="Messages" value={stats.message_count} />
          <StatCard icon={<Zap size={16} />} label="Total Tokens" value={stats.total_tokens.toLocaleString()} />
          <StatCard
            icon={<Clock size={16} />}
            label="Avg Response"
            value={stats.avg_response_time_ms > 0 ? `${(stats.avg_response_time_ms / 1000).toFixed(1)}s` : '—'}
          />
        </div>
      </div>

      {/* Global stats */}
      <div>
        <h3 style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
          Global Analytics
        </h3>
        {analyticsLoading ? (
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>Loading…</p>
        ) : analytics ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {analytics.ecommerce && (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <StatCard icon={<ShoppingBag size={16} />} label="Orders" value={analytics.ecommerce.total_orders ?? 0} sub={`${analytics.ecommerce.orders_today ?? 0} today`} />
                <StatCard icon={<DollarSign size={16} />} label="Revenue" value={`$${(analytics.ecommerce.total_revenue ?? 0).toLocaleString()}`} sub={`$${analytics.ecommerce.revenue_today ?? 0} today`} />
                <StatCard icon={<Users size={16} />} label="Customers" value={analytics.ecommerce.total_customers ?? 0} />
                <StatCard icon={<BarChart2 size={16} />} label="Products" value={analytics.ecommerce.total_products ?? 0} />
              </div>
            )}
            {analytics.conversations && (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <StatCard icon={<MessageSquare size={16} />} label="Conversations" value={analytics.conversations.total_conversations ?? 0} sub={`${analytics.conversations.conversations_today ?? 0} today`} />
                <StatCard icon={<Zap size={16} />} label="Total Tokens" value={(analytics.conversations.total_tokens_used ?? 0).toLocaleString()} />
                <StatCard icon={<MessageSquare size={16} />} label="Messages Today" value={analytics.conversations.messages_today ?? 0} />
              </div>
            )}
            {!analytics.ecommerce && !analytics.conversations && (
              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>Analytics data unavailable.</p>
            )}
          </div>
        ) : (
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>No data available.</p>
        )}
      </div>
    </div>
  );
}
