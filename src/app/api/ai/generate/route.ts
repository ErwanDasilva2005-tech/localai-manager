import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import http from 'node:http';
import { Readable } from 'node:stream';

const ALLOWED_ORIGINS = ['http://localhost:3000', 'http://localhost:3001'];

function corsHeaders(origin: string | null) {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
  };
}

export async function OPTIONS(req: Request) {
  const origin = req.headers.get('origin');
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

// Calls Ollama using Node's raw http module, forcing IPv4 (family: 4).
// This sidesteps a known Node/undici bug where fetch() can hang or fail
// on "localhost"/"127.0.0.1" even when curl and the browser succeed instantly.
function callOllama(payload: object): Promise<http.IncomingMessage> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 11434,
        path: '/api/generate',
        method: 'POST',
        family: 4, // force IPv4, skip the IPv6-first resolution that causes the hang
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
        timeout: 30000,
      },
      (res) => resolve(res)
    );

    req.on('timeout', () => {
      req.destroy(new Error('TIMEOUT'));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

export async function POST(req: Request) {
  const origin = req.headers.get('origin');
  const headers = corsHeaders(origin);

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });
  }

  let body: { model?: string; prompt?: string; system?: string; stream?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400, headers });
  }

  const { model, prompt, system, stream = true } = body;
  if (!model || !prompt) {
    return NextResponse.json(
      { error: 'Both "model" and "prompt" are required' },
      { status: 400, headers }
    );
  }

  let ollamaRes: http.IncomingMessage;
  try {
    ollamaRes = await callOllama({ model, prompt, system, stream });
  } catch (err) {
    console.error('Gateway → Ollama connection failed:', err);
    const isTimeout = err instanceof Error && err.message === 'TIMEOUT';
    return NextResponse.json(
      {
        error: isTimeout
          ? 'Ollama took too long to respond (model may be loading — try again)'
          : 'Could not reach Ollama — is it running?',
      },
      { status: 502, headers }
    );
  }

  if ((ollamaRes.statusCode ?? 500) >= 400) {
    return NextResponse.json(
      { error: `Ollama returned status ${ollamaRes.statusCode}` },
      { status: 502, headers }
    );
  }

  // Convert Ollama's Node.js stream into a Web ReadableStream Next.js can return
  const webStream = Readable.toWeb(ollamaRes) as ReadableStream;

  if (!stream) {
    const reader = webStream.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullResponse = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
    }
    for (const line of buffer.split('\n').filter(Boolean)) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.response) fullResponse += parsed.response;
      } catch {
        // skip malformed line
      }
    }
    return NextResponse.json({ response: fullResponse }, { headers });
  }

  return new Response(webStream, {
    status: 200,
    headers: {
      ...headers,
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache',
    },
  });
}