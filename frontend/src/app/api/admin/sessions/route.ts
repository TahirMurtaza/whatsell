export const dynamic = 'force-dynamic';

const backendBase = () => {
  const url = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  return url.endsWith('/') ? url.slice(0, -1) : url;
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const qs = searchParams.toString();
    const res = await fetch(
      `${backendBase()}/api/v1/admin/sessions${qs ? '?' + qs : ''}`,
      { cache: 'no-store' }
    );
    const text = await res.text();
    return new Response(text || '{"sessions":[],"total":0}', {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[admin/sessions] proxy error:', err);
    return new Response(JSON.stringify({ error: 'Failed to fetch sessions', sessions: [], total: 0 }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
