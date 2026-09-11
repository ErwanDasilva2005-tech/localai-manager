export interface GatewayTestResult {
  success: boolean;
  response?: string;
  error?: string;
}

export async function testViaGateway(
  modelName: string,
  prompt: string,
  onChunk: (text: string) => void,
  signal?: AbortSignal
): Promise<GatewayTestResult> {
  try {
    const res = await fetch('/api/ai/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelName, prompt, stream: true }),
      signal,
    });

    if (!res.ok) {
      // Our gateway returns { error: "..." } as JSON on failure, not a stream
      const errBody = await res.json().catch(() => null);
      return {
        success: false,
        error: errBody?.error ?? `Gateway returned status ${res.status}`,
      };
    }
    if (!res.body) {
      return { success: false, error: 'No response body from gateway' };
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? ''; // keep incomplete line for next chunk

      for (const line of lines) {
        if (!line.trim()) continue;
        const parsed = JSON.parse(line);
        if (parsed.response) {
          fullText += parsed.response;
          onChunk(fullText);
        }
      }
    }

    return { success: true, response: fullText };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { success: false, error: 'Request cancelled' };
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error contacting gateway',
    };
  }
}