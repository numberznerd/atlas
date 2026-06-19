"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, logAudit } from "@/lib/auth";
import { transcribeAudioFromUrl } from "@/lib/ai/transcription";
import { summarizeTranscript } from "@/lib/ai/summary";
import { updateClientBrief } from "@/lib/ai/brief";
import { indexDocument } from "@/lib/ai/indexing";
import { AiNotConfiguredError } from "@/lib/ai/provider";
import { isLlmConfigured } from "@/lib/env";
import type {
  Database,
  SummaryPoint,
  SummarySections,
  TranscriptSegment,
} from "@/lib/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface MeetingFormState {
  error?: string;
}
export interface ActionResult {
  ok: boolean;
  error?: string;
}

function transcriptToText(segments: TranscriptSegment[]): string {
  return segments.map((s) => `${s.speaker}: ${s.text}`).join("\n");
}

/** Record a meeting after its audio (if any) has been uploaded to Storage. */
export async function createMeetingAction(
  _prev: MeetingFormState,
  formData: FormData,
): Promise<MeetingFormState> {
  const user = await getCurrentUser();
  if (!user?.profile.firm_id) redirect("/login");

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Give the meeting a title." };

  const clientId = String(formData.get("client_id") ?? "") || null;
  const occurredAt = String(formData.get("occurred_at") ?? "") || null;
  const audioPath = String(formData.get("audio_path") ?? "") || null;
  const consentRecorded = formData.get("consent_recorded") === "on";
  const consentNote = String(formData.get("consent_note") ?? "").trim() || null;

  if (audioPath && !consentRecorded) {
    return { error: "Please confirm recording consent was obtained before processing audio." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meetings")
    .insert({
      firm_id: user.profile.firm_id,
      client_id: clientId,
      title,
      occurred_at: occurredAt,
      source: "upload",
      status: "uploaded",
      consent_recorded: consentRecorded,
      consent_note: consentNote,
      audio_path: audioPath,
      created_by: user.authId,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  await logAudit("meeting.uploaded", {
    targetType: "meeting",
    targetId: data.id,
    payload: { title, has_audio: Boolean(audioPath) },
  });
  redirect(`/meetings/${data.id}`);
}

/** Full pipeline: transcribe audio -> summarize -> extract actions -> index. */
export async function processMeetingAction(formData: FormData): Promise<ActionResult> {
  const meetingId = String(formData.get("meeting_id"));
  const supabase = await createClient();

  const { data: meeting } = await supabase.from("meetings").select("*").eq("id", meetingId).single();
  if (!meeting) return { ok: false, error: "Meeting not found." };
  if (!meeting.audio_path) {
    return { ok: false, error: "No audio on this meeting. Paste a transcript instead." };
  }

  try {
    await supabase.from("meetings").update({ status: "transcribing" }).eq("id", meetingId);

    const { data: signed, error: signErr } = await supabase.storage
      .from("meeting-audio")
      .createSignedUrl(meeting.audio_path, 600);
    if (signErr || !signed) throw new Error("Could not read the audio file.");

    const result = await transcribeAudioFromUrl(signed.signedUrl);

    await supabase.from("transcripts").upsert(
      {
        meeting_id: meetingId,
        firm_id: meeting.firm_id,
        segments: result.segments,
        language: result.language,
        provider: result.provider,
        word_count: result.wordCount,
      },
      { onConflict: "meeting_id" },
    );
    await supabase
      .from("meetings")
      .update({ status: "transcribed", language: result.language, duration_seconds: durationFrom(result.segments) })
      .eq("id", meetingId);

    await logAudit("meeting.transcribed", { targetType: "meeting", targetId: meetingId });

    await runSummaryAndIndex(supabase, meetingId, result.segments, meeting.firm_id, meeting.client_id);
    revalidatePath(`/meetings/${meetingId}`);
    return { ok: true };
  } catch (err) {
    await supabase.from("meetings").update({ status: "failed" }).eq("id", meetingId);
    revalidatePath(`/meetings/${meetingId}`);
    if (err instanceof AiNotConfiguredError) return { ok: false, error: err.message };
    return { ok: false, error: err instanceof Error ? err.message : "Processing failed." };
  }
}

/** Save a manually pasted transcript (works with no STT provider). */
export async function saveManualTranscriptAction(formData: FormData): Promise<ActionResult> {
  const meetingId = String(formData.get("meeting_id"));
  const text = String(formData.get("transcript") ?? "").trim();
  if (text.length < 10) return { ok: false, error: "Transcript is too short." };

  const supabase = await createClient();
  const { data: meeting } = await supabase
    .from("meetings")
    .select("firm_id, client_id")
    .eq("id", meetingId)
    .single();
  if (!meeting) return { ok: false, error: "Meeting not found." };

  // Parse "Speaker: text" lines into segments; otherwise one segment per line.
  const segments: TranscriptSegment[] = text
    .split(/\n+/)
    .filter(Boolean)
    .map((line, i) => {
      const m = line.match(/^([^:]{1,40}):\s*(.*)$/);
      return {
        speaker: m ? m[1].trim() : "Speaker 1",
        start_ms: i * 1000,
        end_ms: i * 1000 + 1000,
        text: m ? m[2] : line,
      };
    });

  try {
    await supabase.from("transcripts").upsert(
      {
        meeting_id: meetingId,
        firm_id: meeting.firm_id,
        segments,
        language: "en",
        provider: "manual",
        word_count: text.split(/\s+/).filter(Boolean).length,
      },
      { onConflict: "meeting_id" },
    );
    await supabase.from("meetings").update({ status: "transcribed" }).eq("id", meetingId);
    await logAudit("meeting.transcribed", { targetType: "meeting", targetId: meetingId, payload: { manual: true } });

    await runSummaryAndIndex(supabase, meetingId, segments, meeting.firm_id, meeting.client_id);
    revalidatePath(`/meetings/${meetingId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not save transcript." };
  }
}

/** Generate (or regenerate) the summary from an existing transcript. */
export async function generateSummaryAction(formData: FormData): Promise<ActionResult> {
  const meetingId = String(formData.get("meeting_id"));
  const supabase = await createClient();
  const { data: meeting } = await supabase
    .from("meetings")
    .select("firm_id, client_id")
    .eq("id", meetingId)
    .single();
  const { data: transcript } = await supabase
    .from("transcripts")
    .select("segments")
    .eq("meeting_id", meetingId)
    .single();
  if (!meeting || !transcript) return { ok: false, error: "Transcribe the meeting first." };

  try {
    await runSummaryAndIndex(supabase, meetingId, transcript.segments, meeting.firm_id, meeting.client_id, {
      force: true,
    });
    revalidatePath(`/meetings/${meetingId}`);
    return { ok: true };
  } catch (err) {
    if (err instanceof AiNotConfiguredError) return { ok: false, error: err.message };
    return { ok: false, error: err instanceof Error ? err.message : "Could not generate summary." };
  }
}

// --- internals -------------------------------------------------------------

function durationFrom(segments: TranscriptSegment[]): number | null {
  if (segments.length === 0) return null;
  return Math.round(segments[segments.length - 1].end_ms / 1000);
}

async function runSummaryAndIndex(
  supabase: SupabaseClient<Database>,
  meetingId: string,
  segments: TranscriptSegment[],
  firmId: string,
  clientId: string | null,
  opts: { force?: boolean } = {},
) {
  // Always index the transcript so it's searchable (keyword works without AI).
  const { data: m } = await supabase.from("meetings").select("title").eq("id", meetingId).single();
  await indexDocument(supabase, {
    firmId,
    clientId,
    type: "transcript",
    title: `Transcript — ${m?.title ?? "Meeting"}`,
    meetingId,
    text: transcriptToText(segments),
  });

  // Summarize only when an LLM is configured.
  if (!isLlmConfigured()) {
    if (opts.force) throw new AiNotConfiguredError("LLM provider");
    return;
  }

  await supabase.from("meetings").update({ status: "summarizing" }).eq("id", meetingId);
  const sections = await summarizeTranscript(segments);

  await supabase.from("summaries").upsert(
    { meeting_id: meetingId, firm_id: firmId, sections, finalized: true, model: "configured" },
    { onConflict: "meeting_id" },
  );

  // Turn commitments into tracked action items (PRD §6.5).
  await createActionItemsFromSummary(supabase, meetingId, firmId, clientId, sections);

  await indexDocument(supabase, {
    firmId,
    clientId,
    type: "summary",
    title: `Summary — ${m?.title ?? "Meeting"}`,
    meetingId,
    text: summaryToText(sections),
  });

  // Update the client's rolling memory — this is how Atlas "learns" over time.
  if (clientId) {
    try {
      await updateClientBrief(supabase, clientId, sections);
      await logAudit("client.memory_updated", { targetType: "client", targetId: clientId });
    } catch {
      // Memory refresh is best-effort; never fail the pipeline over it.
    }
  }

  await supabase.from("meetings").update({ status: "ready" }).eq("id", meetingId);
  await logAudit("meeting.summarized", { targetType: "meeting", targetId: meetingId });
}

async function createActionItemsFromSummary(
  supabase: SupabaseClient<Database>,
  meetingId: string,
  firmId: string,
  clientId: string | null,
  sections: SummarySections,
) {
  const build = (points: SummaryPoint[] | undefined, owner: "firm" | "client") =>
    (points ?? []).map((p) => ({
      firm_id: firmId,
      client_id: clientId,
      meeting_id: meetingId,
      owner_type: owner,
      description: p.text,
      status: "open" as const,
      source_ref: { meeting_id: meetingId, ts: p.ts },
    }));

  const rows = [
    ...build(sections.firm_commitments, "firm"),
    ...build(sections.client_commitments, "client"),
  ];
  if (rows.length > 0) await supabase.from("action_items").insert(rows);
}

function summaryToText(s: SummarySections): string {
  const lines: string[] = [];
  const add = (label: string, pts?: SummaryPoint[]) => {
    if (pts && pts.length) {
      lines.push(`${label}:`);
      pts.forEach((p) => lines.push(`- ${p.text}`));
    }
  };
  add("Discussion points", s.discussion_points);
  add("Decisions", s.decisions);
  add("Client commitments", s.client_commitments);
  add("Firm commitments", s.firm_commitments);
  add("Risks and flags", s.risks);
  if (s.next_meeting?.text) lines.push(`Next meeting: ${s.next_meeting.text}`);
  return lines.join("\n");
}
