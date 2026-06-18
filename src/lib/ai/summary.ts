import "server-only";
import { chatComplete } from "@/lib/ai/provider";
import { SUMMARY_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import type { SummarySections, TranscriptSegment } from "@/lib/types/database";

/** Render diarized segments into a timestamped transcript for the model. */
function renderTranscript(segments: TranscriptSegment[]): string {
  return segments
    .map((s) => `[${Math.floor(s.start_ms / 1000)}s] ${s.speaker}: ${s.text}`)
    .join("\n");
}

/**
 * Produce an accounting-aware structured summary (PRD §6.4). Returns sections
 * with transcript timestamps so the UI can link each point back to its source.
 */
export async function summarizeTranscript(
  segments: TranscriptSegment[],
): Promise<SummarySections> {
  const transcript = renderTranscript(segments);
  const raw = await chatComplete(
    [
      { role: "system", content: SUMMARY_SYSTEM_PROMPT },
      { role: "user", content: `Meeting transcript:\n\n${transcript}` },
    ],
    { json: true, temperature: 0.1, maxTokens: 1800 },
  );

  let parsed: SummarySections;
  try {
    parsed = JSON.parse(raw) as SummarySections;
  } catch {
    // Defensive: never let a malformed model response crash processing.
    parsed = { discussion_points: [{ text: raw.slice(0, 500) }] };
  }
  return parsed;
}
