import "server-only";
import { env, isSttConfigured } from "@/lib/env";
import { AiNotConfiguredError } from "@/lib/ai/provider";
import type { TranscriptSegment } from "@/lib/types/database";

export interface TranscriptionResult {
  segments: TranscriptSegment[];
  language: string;
  provider: string;
  wordCount: number;
}

/**
 * Transcribe audio with speaker diarization (PRD §6.3 F-3.2). The provider is
 * pluggable to keep the residency decision open (PRD §7.3): managed STT
 * (Deepgram/AssemblyAI) for launch, self-hosted Canadian Whisper for strict
 * residency / Québec Law 25 firms. Accepts a URL the provider can fetch
 * (a short-lived Supabase Storage signed URL).
 */
export async function transcribeAudioFromUrl(audioUrl: string): Promise<TranscriptionResult> {
  if (!isSttConfigured()) throw new AiNotConfiguredError("Speech-to-text provider");

  switch (env.stt.provider) {
    case "openai":
      return transcribeWithOpenAI(audioUrl);
    case "deepgram":
      return transcribeWithDeepgram(audioUrl);
    case "assemblyai":
    case "whisper-ca":
      // Concrete adapters for the Canada-only self-hosted Whisper tier and
      // AssemblyAI plug in here behind the same return shape.
      throw new Error(
        `STT provider "${env.stt.provider}" is selected but its adapter is not implemented yet.`,
      );
    default:
      throw new AiNotConfiguredError(`STT provider "${env.stt.provider}"`);
  }
}

/**
 * OpenAI Whisper (whisper-1). No speaker diarization, but it returns
 * timestamped segments and uses the same OpenAI key as the LLM — the
 * lowest-friction path to a working demo. Whisper caps uploads at 25MB.
 */
async function transcribeWithOpenAI(audioUrl: string): Promise<TranscriptionResult> {
  const audioRes = await fetch(audioUrl);
  if (!audioRes.ok) throw new Error("Could not download the audio for transcription.");
  const blob = await audioRes.blob();

  const form = new FormData();
  form.append("file", blob, "audio");
  form.append("model", "whisper-1");
  form.append("response_format", "verbose_json");

  const base = env.llm.endpoint && env.stt.provider === "openai" && env.llm.provider === "openai"
    ? env.llm.endpoint.replace(/\/$/, "")
    : "https://api.openai.com/v1";

  const res = await fetch(`${base}/audio/transcriptions`, {
    method: "POST",
    headers: { authorization: `Bearer ${env.stt.apiKey}` },
    body: form,
  });
  if (!res.ok) {
    throw new Error(`OpenAI transcription failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as {
    text: string;
    language?: string;
    segments?: { start: number; end: number; text: string }[];
  };

  const rawSegments = data.segments ?? [];
  const segments: TranscriptSegment[] = rawSegments.length
    ? rawSegments.map((s) => ({
        speaker: "Speaker 1",
        start_ms: Math.round(s.start * 1000),
        end_ms: Math.round(s.end * 1000),
        text: s.text.trim(),
      }))
    : [{ speaker: "Speaker 1", start_ms: 0, end_ms: 0, text: data.text }];

  return {
    segments,
    language: data.language ?? "en",
    provider: "openai-whisper",
    wordCount: data.text.split(/\s+/).filter(Boolean).length,
  };
}

interface DeepgramUtterance {
  speaker?: number;
  start: number;
  end: number;
  transcript: string;
}

async function transcribeWithDeepgram(audioUrl: string): Promise<TranscriptionResult> {
  const params = new URLSearchParams({
    model: "nova-2",
    diarize: "true",
    punctuate: "true",
    utterances: "true",
    detect_language: "true",
  });
  const res = await fetch(`https://api.deepgram.com/v1/listen?${params.toString()}`, {
    method: "POST",
    headers: {
      authorization: `Token ${env.stt.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ url: audioUrl }),
  });
  if (!res.ok) {
    throw new Error(`Deepgram request failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as {
    results?: {
      utterances?: DeepgramUtterance[];
      channels?: { detected_language?: string }[];
    };
  };

  const utterances = data.results?.utterances ?? [];
  const segments: TranscriptSegment[] = utterances.map((u) => ({
    speaker: `Speaker ${(u.speaker ?? 0) + 1}`,
    start_ms: Math.round(u.start * 1000),
    end_ms: Math.round(u.end * 1000),
    text: u.transcript,
  }));
  const wordCount = segments.reduce((n, s) => n + s.text.split(/\s+/).filter(Boolean).length, 0);

  return {
    segments,
    language: data.results?.channels?.[0]?.detected_language ?? "en",
    provider: "deepgram",
    wordCount,
  };
}
