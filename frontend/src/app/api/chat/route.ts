import { StreamingTextResponse, StreamData } from 'ai';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const data = new StreamData();
  
  try {
    const { messages, data: requestData } = await req.json();
    const lastMessage = messages[messages.length - 1];
    const kbSessionId: string | null = requestData?.kbSessionId ?? null;

    const baseUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const apiUrl = `${cleanBaseUrl}/api/v1/chat/`;

    console.log(`[Chat Bridge] Target API: ${apiUrl}, kb_session: ${kbSessionId ?? 'none'}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: lastMessage.content,
        customer_phone: requestData?.phone || 'anonymous',
        session_id: requestData?.sessionId || 'default_session',
        source: 'web',
        kb_session_id: kbSessionId,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Backend error ${response.status}: ${errorText}`);
    }

    const result = await response.json();

    // Attach product metadata directly to the message via annotations.
    // appendMessageAnnotation pins the data to THIS message — no index correlation needed.
    const products = result.context?.products;
    console.log(`[Chat Bridge] Products: ${products?.length ?? 0}, session: ${result.session_id}`);
    data.appendMessageAnnotation({
      type: 'products',
      products: products && products.length > 0 ? products : [],
      sessionId: result.session_id,
    });


    // Protocol framing:
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const textPart = `0:${JSON.stringify(result.reply || '')}\n`;
        controller.enqueue(encoder.encode(textPart));
        
        controller.close();
        data.close();
      },
    });

    return new StreamingTextResponse(stream, {}, data);

  } catch (error: any) {
    console.error('[Chat Bridge] Error:', error.message);
    data.close();
    return new Response(JSON.stringify({ 
      error: 'Service unavailable',
      details: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}





