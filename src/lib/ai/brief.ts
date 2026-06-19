import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { chatComplete } from "@/lib/ai/provider";
import { CLIENT_BRIEF_SYSTEM_PROMPT, buildClientBriefPrompt } from "@/lib/ai/prompts";
import { isLlmConfigured } from "@/lib/env";
import type { Database, SummaryPoint, SummarySections } from "@/lib/types/database";

type Client = SupabaseClient<Database>;

function summaryToText(s: SummarySections): string {
  const lines: string[] = [];
  const add = (label: string, pts?: SummaryPoint[]) => {
    if (pts && pts.length) lines.push(`${label}: ${pts.map((p) => p.text).join("; ")}`);
  };
  add("Discussed", s.discussion_points);
  add("Decisions", s.decisions);
  add("Client commitments", s.client_commitments);
  add("Firm commitments", s.firm_commitments);
  add("Risks", s.risks);
  if (s.next_meeting?.text) lines.push(`Next: ${s.next_meeting.text}`);
  return lines.join("\n");
}

/**
 * Regenerate a client's rolling AI brief after a meeting is processed — this is
 * how Atlas "remembers" and gets more valuable over time. Incremental: it folds
 * the newest summary into the existing brief. Best-effort; a failure here must
 * never fail the meeting pipeline.
 */
export async function updateClientBrief(
  supabase: Client,
  clientId: string,
  newSummary: SummarySections,
): Promise<void> {
  if (!isLlmConfigured()) return;

  const { data: client } = await supabase
    .from("clients")
    .select("name, ai_brief")
    .eq("id", clientId)
    .single();
  if (!client) return;

  const summaryText = summaryToText(newSummary);
  if (!summaryText.trim()) return;

  const brief = await chatComplete(
    [
      { role: "system", content: CLIENT_BRIEF_SYSTEM_PROMPT },
      { role: "user", content: buildClientBriefPrompt(client.name, client.ai_brief, summaryText) },
    ],
    { temperature: 0.2, maxTokens: 500 },
  );

  if (brief.trim()) {
    await supabase
      .from("clients")
      .update({ ai_brief: brief.trim(), ai_brief_updated_at: new Date().toISOString() })
      .eq("id", clientId);
  }
}
