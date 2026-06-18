/**
 * Centralized environment access.
 *
 * Supabase vars are required for the app to function. The AI vars (LLM, STT,
 * embeddings) are optional: when absent, AI-dependent features degrade
 * gracefully (e.g. knowledge search falls back to keyword-only, transcription
 * shows a "configure a provider" state) rather than crashing. This keeps the
 * provider decisions in PRD §7.3/§13.2 open.
 */

function required(name: string, value: string | undefined): string {
  if (!value || value.length === 0) {
    // Surface a clear message at first use rather than a cryptic client error.
    throw new Error(
      `Missing required environment variable: ${name}. See .env.example and the README "Setup" section.`,
    );
  }
  return value;
}

export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",

  // Server-only AI configuration (never exposed to the browser).
  llm: {
    provider: (process.env.ATLAS_LLM_PROVIDER ?? "").toLowerCase(), // "azure-openai" | "bedrock" | ""
    apiKey: process.env.ATLAS_LLM_API_KEY ?? "",
    endpoint: process.env.ATLAS_LLM_ENDPOINT ?? "",
    model: process.env.ATLAS_LLM_MODEL ?? "",
    embeddingModel: process.env.ATLAS_EMBEDDING_MODEL ?? "",
  },
  stt: {
    provider: (process.env.ATLAS_STT_PROVIDER ?? "").toLowerCase(), // "deepgram" | "assemblyai" | "whisper-ca" | ""
    apiKey: process.env.ATLAS_STT_API_KEY ?? "",
  },
} as const;

export function requireSupabaseEnv() {
  return {
    url: required("NEXT_PUBLIC_SUPABASE_URL", env.supabaseUrl),
    anonKey: required("NEXT_PUBLIC_SUPABASE_ANON_KEY", env.supabaseAnonKey),
  };
}

/** Whether an LLM provider is configured (drives summaries + RAG chat). */
export const isLlmConfigured = () => env.llm.provider !== "" && env.llm.apiKey !== "";

/** Whether embeddings are configured (drives semantic/hybrid search). */
export const isEmbeddingConfigured = () =>
  isLlmConfigured() && env.llm.embeddingModel !== "";

/** Whether a speech-to-text provider is configured (drives transcription). */
export const isSttConfigured = () => env.stt.provider !== "" && env.stt.apiKey !== "";
