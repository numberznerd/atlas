import { Info } from "lucide-react";
import { isEmbeddingConfigured, isLlmConfigured, isSttConfigured } from "@/lib/env";

/**
 * Shown when AI providers aren't configured yet. The app is fully usable
 * without them (manual transcripts/summaries, keyword search); this just makes
 * the degraded state explicit instead of silently failing.
 */
export function AiStatusBanner() {
  const missing: string[] = [];
  if (!isSttConfigured()) missing.push("transcription (STT)");
  if (!isLlmConfigured()) missing.push("summaries & chat (LLM)");
  else if (!isEmbeddingConfigured()) missing.push("semantic search (embeddings)");

  if (missing.length === 0) return null;

  return (
    <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/5 px-4 py-3 text-sm">
      <Info className="mt-0.5 size-4 shrink-0 text-warning" />
      <div>
        <p className="font-medium text-foreground">Running in manual mode</p>
        <p className="text-muted-foreground">
          No provider configured for {missing.join(" and ")}. Atlas still works — you can add
          transcripts and summaries by hand, and search runs on keywords. Set the{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">ATLAS_*</code> environment
          variables (see <code className="rounded bg-muted px-1 py-0.5 text-xs">.env.example</code>)
          to switch on automatic transcription, AI summaries, and semantic search.
        </p>
      </div>
    </div>
  );
}
