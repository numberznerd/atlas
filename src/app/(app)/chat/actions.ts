"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, logAudit } from "@/lib/auth";
import { answerQuestion, type RagAnswer } from "@/lib/ai/knowledge";

/**
 * Answer a staff question with retrieval-augmented generation (PRD §6.7).
 * Scope is firm-wide (clientId null) or per-client. Always returns citations;
 * falls back to "not enough info" rather than guessing.
 */
export async function askAction(question: string, clientId: string | null): Promise<RagAnswer> {
  const user = await getCurrentUser();
  if (!user?.profile.firm_id) {
    return {
      answer: "Your session expired. Please sign in again.",
      citations: [],
      mode: "keyword",
      unanswered: true,
    };
  }

  const trimmed = question.trim();
  if (trimmed.length < 3) {
    return { answer: "Ask a question to get started.", citations: [], mode: "keyword", unanswered: true };
  }

  const supabase = await createClient();
  await logAudit("chat.query", { payload: { scope: clientId ? "client" : "firm", client_id: clientId } });
  return answerQuestion(supabase, { question: trimmed, clientId });
}
