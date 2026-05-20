export const dynamic = 'force-dynamic';

const backendBase = () => {
  const url = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  return url.endsWith('/') ? url.slice(0, -1) : url;
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const res = await fetch(
      `${backendBase()}/api/v1/admin/sessions/${encodeURIComponent(sessionId)}`,
      { cache: 'no-store' }
    );
    const text = await res.text();
    return new Response(text || '{}', {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[admin/sessions/[sessionId]] proxy error:', err);
    return new Response(JSON.stringify({ error: 'Failed to fetch session detail' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
