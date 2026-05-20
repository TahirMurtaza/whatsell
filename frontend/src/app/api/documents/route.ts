export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const baseUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const clean = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('session_id') || '';

  try {
    const res = await fetch(
      `${clean}/api/v1/documents/?session_id=${encodeURIComponent(sessionId)}`,
    );
    const data = await res.json();
    return new Response(JSON.stringify(data), {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ detail: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
