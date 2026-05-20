import { StreamingTextResponse, StreamData } from 'ai';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const data = new StreamData();

  try {
    const { messages, data: requestData } = await req.json();
    const lastMessage = messages[messages.length - 1];
    const sessionId = requestData?.sessionId || 'kb_default';

    // Build history from prior messages (exclude the last user message we're sending)
    const history = messages.slice(0, -1).map((m: any) => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content,
    }));

    const baseUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const apiUrl = `${cleanBase}/api/v1/kb/chat`;

    console.log(`[KB Chat Bridge] → ${apiUrl}, session=${sessionId}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000); // 90s

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        message: lastMessage.content,
        history,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Backend error ${response.status}: ${errText}`);
    }

    // Backend streams plain text tokens — forward them with AI SDK framing
    const encoder = new TextEncoder();
    const body = response.body!;
    const reader = body.getReader();

    const stream = new ReadableStream({
      async start(ctrl) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const text = new TextDecoder().decode(value);
            // AI SDK text part protocol: `0:"token"\n`
            ctrl.enqueue(encoder.encode(`0:${JSON.stringify(text)}\n`));
          }
        } finally {
          ctrl.close();
          data.close();
        }
      },
    });

    return new StreamingTextResponse(stream, {}, data);
  } catch (error: any) {
    console.error('[KB Chat Bridge] Error:', error.message);
    data.close();
    return new Response(
      JSON.stringify({ error: 'Service unavailable', details: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
