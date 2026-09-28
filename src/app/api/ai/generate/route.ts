import { auth } from '@clerk/nextjs/server';
import { verifyToken } from '@clerk/backend';
import { NextResponse } from 'next/server';
import { generateWithOllama } from '@/lib/providers/ollama';
import { generateWithGroq } from '@/lib/providers/groq';

const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  process.env.NEXT_PUBLIC_APP_URL,      // LocalAI Manager's own prod URL
  process.env.NEXT_PUBLIC_DOCAI_URL,    // DocAI Assistant's prod URL
].filter((v): v is string => Boolean(v));

// Ollama can't be reached from Vercel's serverless functions — it only
// exists on a developer's own machine. Auto-select the working provider.
const USE_CLOUD_PROVIDER = process.env.AI_PROVIDER === 'groq' || !!process.env.VERCEL;

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
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get('origin')) });
}

async function resolveUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const result = await verifyToken(authHeader.slice(7), {
        secretKey: process.env.CLERK_SECRET_KEY!,
        authorizedParties: ALLOWED_ORIGINS,
      });
      return result.sub;
    } catch (err) {
      console.error('Bearer token verification failed:', err);
      return null;
    }
  }
  const { userId } = await auth();
  return userId;
}

export async function POST(req: Request) {
  const headers = corsHeaders(req.headers.get('origin'));

  const userId = await resolveUserId(req);
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
    return NextResponse.json({ error: 'Both "model" and "prompt" are required' }, { status: 400, headers });
  }

  const result = USE_CLOUD_PROVIDER
    ? await generateWithGroq({ model, prompt, system, stream })
    : await generateWithOllama({ model, prompt, system, stream });

  if (result.error) {
    console.error(`Provider error (${USE_CLOUD_PROVIDER ? 'groq' : 'ollama'}):`, result.error);
    return NextResponse.json({ error: result.error, provider: USE_CLOUD_PROVIDER ? 'groq' : 'ollama' }, {
      status: result.statusCode,
      headers,
    });
  }

  if (!stream) {
    return NextResponse.json({ response: result.fullResponse }, { headers });
  }

  return new Response(result.stream, {
    status: 200,
    headers: { ...headers, 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-cache' },
  });
}