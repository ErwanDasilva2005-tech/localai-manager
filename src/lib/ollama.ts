export interface OllamaTestResult {
  success: boolean;
  response?: string;
  error?: string;
}

export async function testOllamaModel(
  modelName: string,
  prompt: string,
  onChunk: (text: string) => void,
  signal?: AbortSignal
): Promise<OllamaTestResult> {
  try {
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelName, prompt, stream: true }),
      signal,
    });

    if (!res.ok) {
      return { success: false, error: `Ollama returned status ${res.status}` };
    }
    if (!res.body) {
      return { success: false, error: 'No response body from Ollama' };
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
    // This is the specific error a browser throws when it can't connect at all
    if (err instanceof TypeError && err.message.includes('fetch')) {
      return {
        success: false,
        error:
          "Can't reach Ollama at localhost:11434. Is it running? Is OLLAMA_ORIGINS set correctly?",
      };
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

export async function checkOllamaHealth(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000); // 2s timeout, don't hang the UI

    const res = await fetch('http://localhost:11434/api/tags', {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false; // covers connection refused, timeout, CORS block — all mean "not reachable"
  }
}