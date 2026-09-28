import type { GenerateRequest, ProviderResult } from './types';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile'; // solid default; swap freely

export async function generateWithGroq(req: GenerateRequest): Promise<ProviderResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return { stream: null, fullResponse: null, error: 'Groq API key not configured', statusCode: 500 };
  }

  const messages = [
    ...(req.system ? [{ role: 'system', content: req.system }] : []),
    { role: 'user', content: req.prompt },
  ];

  let res: Response;
  try {
    res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: GROQ_MODEL, messages, stream: req.stream }),
    });
  } catch {
    return { stream: null, fullResponse: null, error: 'Could not reach Groq', statusCode: 502 };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return { stream: null, fullResponse: null, error: `Groq returned ${res.status}: ${text}`, statusCode: 502 };
  }

  if (!req.stream) {
    const data = await res.json();
    return { stream: null, fullResponse: data.choices?.[0]?.message?.content ?? '', error: null, statusCode: 200 };
  }

  if (!res.body) {
    return { stream: null, fullResponse: null, error: 'No response body from Groq', statusCode: 502 };
  }

  // Transform Groq's OpenAI-style SSE ("data: {...}\n\n") into the same
  // NDJSON `{ response: "..." }\n` shape Ollama produces, so nothing
  // downstream (DocAI's parser, the dashboard's Test panel) needs to change.
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  const normalized = new ReadableStream({
    async start(controller) {
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === '[DONE]') {
            controller.enqueue(encoder.encode(JSON.stringify({ response: '', done: true }) + '\n'));
            continue;
          }
          try {
            const parsed = JSON.parse(payload);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              controller.enqueue(encoder.encode(JSON.stringify({ response: delta, done: false }) + '\n'));
            }
          } catch {}
        }
      }
      controller.close();
    },
  });

  return { stream: normalized, fullResponse: null, error: null, statusCode: 200 };
}