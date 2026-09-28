import http from 'node:http';
import { Readable } from 'node:stream';
import type { GenerateRequest, ProviderResult } from './types';

function callOllamaRaw(payload: object): Promise<http.IncomingMessage> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 11434,
        path: '/api/generate',
        method: 'POST',
        family: 4,
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
        timeout: 30000,
      },
      (res) => resolve(res)
    );
    req.on('timeout', () => req.destroy(new Error('TIMEOUT')));
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

export async function generateWithOllama(req: GenerateRequest): Promise<ProviderResult> {
  let ollamaRes: http.IncomingMessage;
  try {
    ollamaRes = await callOllamaRaw(req);
  } catch (err) {
    const isTimeout = err instanceof Error && err.message === 'TIMEOUT';
    return {
      stream: null,
      fullResponse: null,
      error: isTimeout
        ? 'Ollama took too long to respond (model may be loading — try again)'
        : 'Could not reach Ollama — is it running?',
      statusCode: 502,
    };
  }

  if ((ollamaRes.statusCode ?? 500) >= 400) {
    const chunks: Buffer[] = [];
    for await (const chunk of ollamaRes) chunks.push(chunk);
    return {
      stream: null,
      fullResponse: null,
      error: `Ollama returned status ${ollamaRes.statusCode}: ${Buffer.concat(chunks).toString()}`,
      statusCode: 502,
    };
  }

  const webStream = Readable.toWeb(ollamaRes) as ReadableStream;

  if (!req.stream) {
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
      } catch {}
    }
    return { stream: null, fullResponse, error: null, statusCode: 200 };
  }

  return { stream: webStream, fullResponse: null, error: null, statusCode: 200 };
}