import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { chatComplete, embedTexts } from "@/lib/ai/provider";
import { RAG_SYSTEM_PROMPT, buildRagUserPrompt } from "@/lib/ai/prompts";
import { isEmbeddingConfigured, isLlmConfigured } from "@/lib/env";
import type { Citation, Database, SearchResult } from "@/lib/types/database";

type Client = SupabaseClient<Database>;

export interface SearchOptions {
  query: string;
  clientId?: string | null;
  limit?: number;
}

/**
 * Knowledge-base search (PRD §6.6). Uses hybrid (keyword + semantic) retrieval
 * when embeddings are configured, otherwise falls back to keyword-only — so the
 * feature works before an AI provider is set up. RLS guarantees results are
 * scoped to the firm and the caller's client access.
 */
export async function searchKnowledge(
  supabase: Client,
  { query, clientId = null, limit = 10 }: SearchOptions,
): Promise<{ results: SearchResult[]; mode: "hybrid" | "keyword" }> {
  if (isEmbeddingConfigured()) {
    const [embedding] = await embedTexts([query]);
    const { data, error } = await supabase.rpc("hybrid_search", {
      query_text: query,
      query_embedding: embedding,
      p_client_id: clientId,
      match_limit: limit,
    });
    if (error) throw error;
    return { results: (data ?? []) as SearchResult[], mode: "hybrid" };
  }

  const { data, error } = await supabase.rpc("keyword_search", {
    query_text: query,
    p_client_id: clientId,
    match_limit: limit,
  });
  if (error) throw error;
  return { results: (data ?? []) as SearchResult[], mode: "keyword" };
}

export interface RagAnswer {
  answer: string;
  citations: Citation[];
  mode: "hybrid" | "keyword";
  /** True when no LLM is configured; the UI shows retrieved passages instead. */
  unanswered: boolean;
}

/**
 * Retrieval-augmented answer with citations and a strict "not enough info"
 * fallback (PRD §6.7 F-7.2/F-7.3). Never answers ungrounded on financial topics.
 */
export async function answerQuestion(
  supabase: Client,
  opts: { question: string; clientId?: string | null },
): Promise<RagAnswer> {
  const { results, mode } = await searchKnowledge(supabase, {
    query: opts.question,
    clientId: opts.clientId ?? null,
    limit: 8,
  });

  const citations: Citation[] = results.map((r) => ({
    document_id: r.document_id,
    title: r.document_title,
    snippet: r.content.slice(0, 200),
  }));

  // No LLM configured: return retrieved passages so the feature is still useful.
  if (!isLlmConfigured()) {
    return {
      answer:
        results.length > 0
          ? "An AI provider isn't configured yet, so I can't compose an answer — but here are the most relevant passages from your firm's records:"
          : "I don't have enough information in the firm's records to answer that confidently.",
      citations,
      mode,
      unanswered: results.length === 0,
    };
  }

  if (results.length === 0) {
    return {
      answer: "I don't have enough information in the firm's records to answer that confidently.",
      citations: [],
      mode,
      unanswered: true,
    };
  }

  const answer = await chatComplete(
    [
      { role: "system", content: RAG_SYSTEM_PROMPT },
      {
        role: "user",
        content: buildRagUserPrompt(
          opts.question,
          results.map((r) => ({ title: r.document_title, content: r.content })),
        ),
      },
    ],
    { temperature: 0.1, maxTokens: 800 },
  );

  return { answer, citations, mode, unanswered: false };
}
