export interface GenerateRequest {
  model: string;
  prompt: string;
  system?: string;
  stream: boolean;
}

export interface ProviderResult {
  stream: ReadableStream | null; // present when streaming
  fullResponse: string | null;   // present when non-streaming
  error: string | null;
  statusCode: number;
}