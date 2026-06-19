"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";

const MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];

function pickMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const m of MIME_CANDIDATES) {
    try {
      if (MediaRecorder.isTypeSupported(m)) return m;
    } catch {
      /* ignore */
    }
  }
  return "";
}

function extFor(mime: string): string {
  if (mime.includes("mp4")) return "m4a";
  if (mime.includes("ogg")) return "ogg";
  return "webm";
}

function clock(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * In-browser meeting recorder. Captures mic audio via MediaRecorder and hands
 * the finished clip to the parent for upload. Works on desktop and mobile
 * Safari/Chrome (iOS records as audio/mp4).
 */
export function AudioRecorder({
  onComplete,
  disabled,
}: {
  onComplete: (blob: Blob, filename: string) => void;
  disabled?: boolean;
}) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function start() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = pickMime();
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const type = recorder.mimeType || mime || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
        onComplete(blob, `recording-${stamp}.${extFor(type)}`);
        streamRef.current?.getTracks().forEach((t) => t.stop());
      };

      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } catch {
      setError("Couldn't access the microphone. Check browser permissions and try again.");
    }
  }

  function stop() {
    if (timerRef.current) clearInterval(timerRef.current);
    recorderRef.current?.stop();
    setRecording(false);
  }

  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-muted/20 px-4 py-8">
      {recording ? (
        <>
          <button
            type="button"
            onClick={stop}
            className="flex size-20 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-sm transition-transform active:scale-95"
            aria-label="Stop recording"
          >
            <Square className="size-7 fill-current" />
          </button>
          <div className="flex items-center gap-2 text-sm">
            <span className="size-2 animate-pulse rounded-full bg-destructive" />
            <span className="font-mono text-foreground">{clock(elapsed)}</span>
            <span className="text-muted-foreground">recording…</span>
          </div>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={start}
            disabled={disabled}
            className="flex size-20 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-transform active:scale-95 disabled:opacity-50"
            aria-label="Start recording"
          >
            <Mic className="size-7" />
          </button>
          <p className="text-sm text-muted-foreground">Tap to record the meeting</p>
        </>
      )}
      {error ? <p className="text-center text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
