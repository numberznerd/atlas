"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, Wand2 } from "lucide-react";
import {
  generateSummaryAction,
  processMeetingAction,
  saveManualTranscriptAction,
  type ActionResult,
} from "@/app/(app)/meetings/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function MeetingProcessor({
  meetingId,
  hasAudio,
  hasTranscript,
  hasSummary,
  sttConfigured,
  llmConfigured,
}: {
  meetingId: string;
  hasAudio: boolean;
  hasTranscript: boolean;
  hasSummary: boolean;
  sttConfigured: boolean;
  llmConfigured: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showPaste, setShowPaste] = useState(false);
  const [transcript, setTranscript] = useState("");

  function run(action: (fd: FormData) => Promise<ActionResult>, fd: FormData) {
    setError(null);
    start(async () => {
      const res = await action(fd);
      if (!res.ok) setError(res.error ?? "Something went wrong.");
      else {
        setShowPaste(false);
        setTranscript("");
        router.refresh();
      }
    });
  }

  function fd(extra: Record<string, string> = {}) {
    const f = new FormData();
    f.set("meeting_id", meetingId);
    Object.entries(extra).forEach(([k, v]) => f.set(k, v));
    return f;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {!hasTranscript && hasAudio ? (
          <Button onClick={() => run(processMeetingAction, fd())} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
            Transcribe &amp; summarize
          </Button>
        ) : null}

        {!hasTranscript ? (
          <Button variant="outline" onClick={() => setShowPaste((s) => !s)} disabled={pending}>
            Paste transcript
          </Button>
        ) : null}

        {hasTranscript && !hasSummary ? (
          <Button onClick={() => run(generateSummaryAction, fd())} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            Generate summary
          </Button>
        ) : null}

        {hasSummary ? (
          <Button variant="outline" onClick={() => run(generateSummaryAction, fd())} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            Regenerate summary
          </Button>
        ) : null}
      </div>

      {!hasTranscript && hasAudio && !sttConfigured ? (
        <p className="text-xs text-muted-foreground">
          No transcription provider configured — &ldquo;Transcribe&rdquo; will report that. Paste a
          transcript to proceed in manual mode.
        </p>
      ) : null}

      {hasTranscript && !hasSummary && !llmConfigured ? (
        <p className="text-xs text-muted-foreground">
          Configure an LLM provider to auto-generate the accounting-aware summary and action items.
        </p>
      ) : null}

      {showPaste ? (
        <div className="space-y-2 rounded-lg border border-border p-3">
          <Textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            className="min-h-[160px]"
            placeholder={"Sam Brown: We want to claim SR&ED again this year.\nAdvisor: Let's confirm the eligible projects..."}
          />
          <p className="text-xs text-muted-foreground">
            Tip: prefix lines with a speaker name and colon to preserve who said what.
          </p>
          <Button
            size="sm"
            onClick={() => run(saveManualTranscriptAction, fd({ transcript }))}
            disabled={pending || transcript.trim().length < 10}
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Save transcript
          </Button>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      ) : null}
    </div>
  );
}
