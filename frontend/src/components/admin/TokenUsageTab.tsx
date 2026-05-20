'use client';

interface TokenCounts {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface Message {
  id: string;
  role: string;
  timestamp: string | null;
  metadata: { token_counts?: TokenCounts; [key: string]: any };
}

interface Stats {
  total_prompt_tokens: number;
  total_completion_tokens: number;
  total_tokens: number;
}

export default function TokenUsageTab({
  messages,
  stats,
}: {
  messages: Message[];
  stats: Stats;
}) {
  const turns = messages
    .filter((m) => m.role === 'assistant' && m.metadata?.token_counts?.total_tokens)
    .map((m, i) => ({ turn: i + 1, ...m.metadata.token_counts!, timestamp: m.timestamp }));

  const maxTotal = Math.max(...turns.map((t) => t.total_tokens), 1);

  if (!turns.length) {
    return (
      <p style={{ color: 'rgba(255,255,255,0.4)', padding: '24px' }}>
        No token data yet. Token counts are recorded on new messages.
      </p>
    );
  }

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Summary cards */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        {[
          { label: 'Total Tokens', value: stats.total_tokens },
          { label: 'Prompt Tokens', value: stats.total_prompt_tokens },
          { label: 'Completion Tokens', value: stats.total_completion_tokens },
        ].map(({ label, value }) => (
          <div key={label} style={{
            background: 'var(--card-bg)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 10, padding: '12px 20px', minWidth: 130,
          }}>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{value.toLocaleString()}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              {['Turn', 'Time', 'Prompt', 'Completion', 'Total', 'Proportion'].map((h) => (
                <th key={h} style={{
                  padding: '8px 12px', textAlign: 'left',
                  color: 'rgba(255,255,255,0.45)', fontWeight: 600, fontSize: 11,
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {turns.map((t) => (
              <tr key={t.turn} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ padding: '8px 12px' }}>#{t.turn}</td>
                <td style={{ padding: '8px 12px', color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>
                  {t.timestamp ? new Date(t.timestamp).toLocaleTimeString() : '—'}
                </td>
                <td style={{ padding: '8px 12px' }}>{t.prompt_tokens.toLocaleString()}</td>
                <td style={{ padding: '8px 12px' }}>{t.completion_tokens.toLocaleString()}</td>
                <td style={{ padding: '8px 12px', fontWeight: 600 }}>{t.total_tokens.toLocaleString()}</td>
                <td style={{ padding: '8px 12px', minWidth: 120 }}>
                  {/* CSS bar chart — prompt (primary) + completion (accent) */}
                  <div style={{
                    display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden',
                    background: 'rgba(255,255,255,0.07)', width: '100%',
                  }}>
                    <div style={{
                      width: `${(t.prompt_tokens / maxTotal) * 100}%`,
                      background: 'var(--primary)', transition: 'width 0.3s',
                    }} title={`Prompt: ${t.prompt_tokens}`} />
                    <div style={{
                      width: `${(t.completion_tokens / maxTotal) * 100}%`,
                      background: 'var(--accent, #6366f1)', transition: 'width 0.3s',
                    }} title={`Completion: ${t.completion_tokens}`} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', display: 'flex', gap: 16 }}>
        <span>
          <span style={{ display: 'inline-block', width: 10, height: 10, background: 'var(--primary)', borderRadius: 2, marginRight: 4 }} />
          Prompt tokens
        </span>
        <span>
          <span style={{ display: 'inline-block', width: 10, height: 10, background: 'var(--accent, #6366f1)', borderRadius: 2, marginRight: 4 }} />
          Completion tokens
        </span>
      </div>
    </div>
  );
}
