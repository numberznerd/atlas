import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, ShieldCheck, ShieldAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isLlmConfigured, isSttConfigured } from "@/lib/env";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { MeetingStatusBadge } from "@/components/status-badge";
import { formatDate, formatTimestamp } from "@/lib/utils";
import { MeetingProcessor } from "@/app/(app)/meetings/[id]/meeting-processor";
import { SummaryView } from "@/app/(app)/meetings/[id]/summary-view";
import type { SummarySections, TranscriptSegment } from "@/lib/types/database";

export default async function MeetingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: meeting } = await supabase
    .from("meetings")
    .select("*, client:clients(id, name)")
    .eq("id", id)
    .single();
  if (!meeting) notFound();

  const [{ data: transcript }, { data: summary }, { data: actions }] = await Promise.all([
    supabase.from("transcripts").select("*").eq("meeting_id", id).maybeSingle(),
    supabase.from("summaries").select("*").eq("meeting_id", id).maybeSingle(),
    supabase
      .from("action_items")
      .select("id, description, owner_type, status, due_date")
      .eq("meeting_id", id)
      .order("owner_type"),
  ]);

  const client = meeting.client as unknown as { id: string; name: string } | null;
  const segments = (transcript?.segments ?? []) as TranscriptSegment[];

  return (
    <div className="space-y-6">
      <Link
        href="/meetings"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Meetings
      </Link>

      <PageHeader
        title={meeting.title}
        description={`${client ? client.name : "Unassigned"} · ${formatDate(meeting.occurred_at ?? meeting.created_at)}`}
        action={<MeetingStatusBadge status={meeting.status} />}
      />

      {/* Consent state — PRD §6.3 / compliance */}
      <div
        className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${
          meeting.consent_recorded
            ? "border-accent/30 bg-accent/5"
            : "border-warning/30 bg-warning/5"
        }`}
      >
        {meeting.consent_recorded ? (
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent" />
        ) : (
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" />
        )}
        <div>
          <p className="font-medium text-foreground">
            {meeting.consent_recorded ? "Recording consent recorded" : "No recording consent on file"}
          </p>
          {meeting.consent_note ? (
            <p className="text-muted-foreground">{meeting.consent_note}</p>
          ) : (
            <p className="text-muted-foreground">
              {meeting.consent_recorded
                ? "Consent was confirmed for this meeting."
                : "Audio processing is blocked until consent is confirmed."}
            </p>
          )}
        </div>
      </div>

      {/* Processing controls */}
      <Card>
        <CardHeader>
          <CardTitle>Processing</CardTitle>
        </CardHeader>
        <CardContent>
          <MeetingProcessor
            meetingId={meeting.id}
            hasAudio={Boolean(meeting.audio_path)}
            hasTranscript={Boolean(transcript)}
            hasSummary={Boolean(summary)}
            sttConfigured={isSttConfigured()}
            llmConfigured={isLlmConfigured()}
          />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent>
              {summary ? (
                <SummaryView sections={summary.sections as SummarySections} />
              ) : (
                <EmptyState
                  icon={FileText}
                  title="No summary yet"
                  description={
                    transcript
                      ? "Generate an accounting-aware summary from the transcript above."
                      : "Transcribe or paste a transcript, then generate the summary."
                  }
                />
              )}
            </CardContent>
          </Card>

          {/* Transcript */}
          {segments.length > 0 ? (
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Transcript</CardTitle>
                <Badge variant="muted">
                  {transcript?.provider} · {transcript?.word_count ?? 0} words
                </Badge>
              </CardHeader>
              <CardContent>
                <details className="group">
                  <summary className="cursor-pointer text-sm font-medium text-primary">
                    Show transcript ({segments.length} segments)
                  </summary>
                  <div className="mt-3 max-h-[28rem] space-y-3 overflow-y-auto scrollbar-thin pr-2">
                    {segments.map((s, i) => (
                      <div key={i} className="text-sm">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">{s.speaker}</span>
                          <span className="font-mono">{formatTimestamp(s.start_ms)}</span>
                        </div>
                        <p className="text-foreground">{s.text}</p>
                      </div>
                    ))}
                  </div>
                </details>
              </CardContent>
            </Card>
          ) : null}
        </div>

        {/* Action items */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Action items</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {actions && actions.length > 0 ? (
                actions.map((a) => (
                  <div key={a.id} className="rounded-lg border border-border p-3 text-sm">
                    <p className="text-foreground">{a.description}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge variant={a.owner_type === "client" ? "secondary" : "accent"}>
                        {a.owner_type === "client" ? "Client" : "Firm"}
                      </Badge>
                      {a.due_date ? (
                        <span className="text-xs text-muted-foreground">Due {formatDate(a.due_date)}</span>
                      ) : null}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  Action items are extracted automatically when the summary is generated.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
