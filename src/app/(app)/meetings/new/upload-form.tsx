"use client";

import { useActionState, useRef, useState } from "react";
import { FileAudio, Loader2, ShieldCheck, Upload, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createMeetingAction, type MeetingFormState } from "@/app/(app)/meetings/actions";
import { AudioRecorder } from "@/components/audio-recorder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const initial: MeetingFormState = {};
const ACCEPT = ".mp3,.m4a,.wav,.mp4,audio/*,video/mp4";

export function UploadForm({
  firmId,
  clients,
  defaultClientId,
}: {
  firmId: string;
  clients: { id: string; name: string }[];
  defaultClientId?: string;
}) {
  const [state, formAction, pending] = useActionState(createMeetingAction, initial);
  const [mode, setMode] = useState<"record" | "upload">("record");
  const [audioPath, setAudioPath] = useState("");
  const [fileName, setFileName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function uploadBlob(blob: Blob, name: string) {
    setUploadError(null);
    setUploading(true);
    try {
      const supabase = createClient();
      const safe = name.replace(/[^\w.\-]+/g, "_");
      const path = `${firmId}/${crypto.randomUUID()}/${safe}`;
      const { error } = await supabase.storage.from("meeting-audio").upload(path, blob, {
        upsert: false,
        contentType: blob.type || "application/octet-stream",
      });
      if (error) throw error;
      setAudioPath(path);
      setFileName(name);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  function clearAudio() {
    setAudioPath("");
    setFileName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const hasAudio = Boolean(audioPath);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="audio_path" value={audioPath} />

      <div className="space-y-1.5">
        <Label htmlFor="title">Meeting title</Label>
        <Input id="title" name="title" placeholder="Browns — FY2025 year-end planning" required />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="client_id">Client</Label>
          <Select id="client_id" name="client_id" defaultValue={defaultClientId ?? ""}>
            <option value="">Unassigned</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="occurred_at">When it happened</Label>
          <Input id="occurred_at" name="occurred_at" type="datetime-local" />
        </div>
      </div>

      {/* Capture: record or upload */}
      <div className="space-y-2">
        <Label>Conversation audio</Label>

        {hasAudio ? (
          <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
            <span className="flex items-center gap-2 text-foreground">
              <FileAudio className="size-4 text-accent" /> {fileName}
            </span>
            <button type="button" onClick={clearAudio} className="text-muted-foreground hover:text-foreground" aria-label="Remove audio">
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
              <button
                type="button"
                onClick={() => setMode("record")}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  mode === "record" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
                )}
              >
                Record
              </button>
              <button
                type="button"
                onClick={() => setMode("upload")}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  mode === "upload" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
                )}
              >
                Upload
              </button>
            </div>

            {uploading ? (
              <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Uploading to Canadian storage…
              </div>
            ) : mode === "record" ? (
              <AudioRecorder onComplete={uploadBlob} disabled={uploading} />
            ) : (
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border px-4 py-8 text-sm text-muted-foreground hover:border-primary/40 hover:bg-muted/30">
                <Upload className="size-4" /> Choose an mp3, m4a, wav, or mp4 file
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPT}
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadBlob(f, f.name);
                  }}
                />
              </label>
            )}
          </>
        )}

        <p className="text-xs text-muted-foreground">
          No audio? You can paste a transcript on the next screen.
        </p>
        {uploadError ? <p className="text-sm text-destructive">{uploadError}</p> : null}
      </div>

      {/* Consent — PRD §6.3 F-3.6 */}
      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="consent_recorded" className="mt-1" />
          <span>
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <ShieldCheck className="size-4 text-accent" /> Recording consent obtained
            </span>
            <span className="text-muted-foreground">
              Confirm participants were informed and consented to recording and AI processing
              (required under PIPEDA before audio is processed).
            </span>
          </span>
        </label>
        <div className="mt-3 space-y-1.5">
          <Label htmlFor="consent_note" className="text-xs">
            Consent note (optional)
          </Label>
          <Textarea
            id="consent_note"
            name="consent_note"
            className="min-h-[60px]"
            placeholder="e.g. Verbal consent at start of call; AI note-taking disclosed."
          />
        </div>
      </div>

      {state.error ? (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
      ) : null}

      <Button type="submit" className="w-full sm:w-auto" disabled={pending || uploading}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        Create meeting
      </Button>
    </form>
  );
}
