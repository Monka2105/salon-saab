import OpenAI from "openai";

let client: OpenAI | undefined;

/** Cliente OpenAI-compatible. Con OPENAI_BASE_URL apunta a OpenRouter u otro proveedor. */
export function getLLM(): OpenAI {
  client ??= new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL || undefined,
  });
  return client;
}
