import "server-only";
import { env, isEmbeddingConfigured, isLlmConfigured } from "@/lib/env";

/**
 * Provider-agnostic LLM + embeddings client.
 *
 * The PRD (§7.1, §13.2) leaves the LLM provider open between Azure OpenAI
 * (Canada Central) and AWS Bedrock (Canada Central). Both must be regional,
 * no-training endpoints. This client implements the OpenAI-compatible shape
 * used by Azure OpenAI and OpenAI; Bedrock can be added behind the same two
 * functions without touching callers.
 */

export class AiNotConfiguredError extends Error {
  constructor(what: string) {
    super(`${what} is not configured. Set ATLAS_LLM_* env vars (see .env.example).`);
    this.name = "AiNotConfiguredError";
  }
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

const AZURE_API_VERSION = "2024-10-21";

function chatUrl(): { url: string; headers: Record<string, string> } {
  const { provider, endpoint, model, apiKey } = env.llm;
  if (provider === "azure-openai") {
    return {
      url: `${endpoint.replace(/\/$/, "")}/openai/deployments/${model}/chat/completions?api-version=${AZURE_API_VERSION}`,
      headers: { "api-key": apiKey, "content-type": "application/json" },
    };
  }
  // Generic OpenAI-compatible (OpenAI, or a self-hosted gateway).
  const base = endpoint ? endpoint.replace(/\/$/, "") : "https://api.openai.com/v1";
  return {
    url: `${base}/chat/completions`,
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
  };
}

function embeddingsUrl(): { url: string; headers: Record<string, string> } {
  const { provider, endpoint, embeddingModel, apiKey } = env.llm;
  if (provider === "azure-openai") {
    return {
      url: `${endpoint.replace(/\/$/, "")}/openai/deployments/${embeddingModel}/embeddings?api-version=${AZURE_API_VERSION}`,
      headers: { "api-key": apiKey, "content-type": "application/json" },
    };
  }
  const base = endpoint ? endpoint.replace(/\/$/, "") : "https://api.openai.com/v1";
  return {
    url: `${base}/embeddings`,
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
  };
}

/** Generate a chat completion. Throws AiNotConfiguredError if no provider. */
export async function chatComplete(
  messages: ChatMessage[],
  opts: { temperature?: number; maxTokens?: number; json?: boolean } = {},
): Promise<string> {
  if (!isLlmConfigured()) throw new AiNotConfiguredError("LLM provider");
  const { url, headers } = chatUrl();

  const body: Record<string, unknown> = {
    messages,
    temperature: opts.temperature ?? 0.2,
    max_tokens: opts.maxTokens ?? 1500,
  };
  if (env.llm.provider !== "azure-openai") body.model = env.llm.model;
  if (opts.json) body.response_format = { type: "json_object" };

  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  if (!res.ok) {
    throw new Error(`LLM request failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as {
    choices: { message: { content: string } }[];
  };
  return data.choices[0]?.message?.content ?? "";
}

/** Embed one or more texts. Returns a vector per input. */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (!isEmbeddingConfigured()) throw new AiNotConfiguredError("Embeddings");
  const { url, headers } = embeddingsUrl();

  const body: Record<string, unknown> = { input: texts };
  if (env.llm.provider !== "azure-openai") body.model = env.llm.embeddingModel;

  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  if (!res.ok) {
    throw new Error(`Embedding request failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { data: { embedding: number[] }[] };
  return data.data.map((d) => d.embedding);
}

/** pgvector accepts the literal form '[0.1,0.2,...]'. */
export function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}
