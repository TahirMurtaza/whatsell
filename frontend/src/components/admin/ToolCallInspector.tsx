'use client';
import { useState } from 'react';
import { ChevronDown, ChevronRight, Wrench } from 'lucide-react';

interface ToolCall {
  tool: string;
  input: string;
  output: string;
}

interface Message {
  id: string;
  role: string;
  timestamp: string | null;
  metadata: { tool_calls?: ToolCall[]; [key: string]: any };
}

function tryPrettyJson(s: string): string {
  try { return JSON.stringify(JSON.parse(s), null, 2); } catch { return s; }
}

export default function ToolCallInspector({ messages }: { messages: Message[] }) {
  const [expandedTurn, setExpandedTurn] = useState<string | null>(null);
  const [expandedOutput, setExpandedOutput] = useState<Record<string, boolean>>({});

  const turns = messages
    .filter((m) => m.role === 'assistant' && (m.metadata?.tool_calls?.length ?? 0) > 0)
    .map((m, i) => ({ turnIndex: i + 1, ...m }));

  if (!turns.length) {
    return (
      <p style={{ color: 'rgba(255,255,255,0.4)', padding: '24px' }}>
        No tool calls recorded in this session.
      </p>
    );
  }

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {turns.map((turn) => {
        const isOpen = expandedTurn === turn.id;
        const calls = turn.metadata.tool_calls!;
        return (
          <div key={turn.id} style={{
            background: 'var(--card-bg)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 10, overflow: 'hidden',
          }}>
            {/* Turn header */}
            <button
              onClick={() => setExpandedTurn(isOpen ? null : turn.id)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                padding: '12px 16px', background: 'transparent', border: 'none',
                cursor: 'pointer', color: '#fff', textAlign: 'left',
              }}
            >
              {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              <Wrench size={14} style={{ color: 'var(--primary)' }} />
              <span style={{ fontSize: 14, fontWeight: 600 }}>
                Turn {turn.turnIndex}
              </span>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                {calls.length} tool call{calls.length !== 1 ? 's' : ''}
              </span>
              {turn.timestamp && (
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                  {new Date(turn.timestamp).toLocaleTimeString()}
                </span>
              )}
            </button>

            {isOpen && (
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                {calls.map((call, ci) => {
                  const outputKey = `${turn.id}-${ci}`;
                  const outputExpanded = expandedOutput[outputKey];
                  const outputLines = call.output.split('\n');
                  const truncated = !outputExpanded && outputLines.length > 20;
                  const displayOutput = truncated ? outputLines.slice(0, 20).join('\n') + '\n...' : call.output;

                  return (
                    <div key={ci} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {/* Tool name badge */}
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        background: 'rgba(99,102,241,0.15)', color: '#818cf8',
                        border: '1px solid rgba(99,102,241,0.25)',
                        borderRadius: 6, padding: '2px 10px', fontSize: 12, fontWeight: 600,
                        alignSelf: 'flex-start',
                      }}>
                        {call.tool}
                      </span>

                      {/* Input */}
                      <div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Input</div>
                        <pre style={{
                          background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.07)',
                          borderRadius: 6, padding: '8px 12px', fontSize: 12,
                          overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                          margin: 0, color: '#e2e8f0',
                        }}>
                          {tryPrettyJson(call.input)}
                        </pre>
                      </div>

                      {/* Output */}
                      <div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Output</div>
                        <pre style={{
                          background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.07)',
                          borderRadius: 6, padding: '8px 12px', fontSize: 12,
                          overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                          margin: 0, color: '#94a3b8',
                        }}>
                          {tryPrettyJson(displayOutput)}
                        </pre>
                        {outputLines.length > 20 && (
                          <button
                            onClick={() => setExpandedOutput(prev => ({ ...prev, [outputKey]: !outputExpanded }))}
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer',
                              color: 'var(--primary)', fontSize: 12, marginTop: 4, padding: 0,
                            }}
                          >
                            {outputExpanded ? 'Show less' : `Show all ${outputLines.length} lines`}
                          </button>
                        )}
                      </div>

                      {ci < calls.length - 1 && (
                        <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.05)', margin: '4px 0' }} />
                      )}
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
