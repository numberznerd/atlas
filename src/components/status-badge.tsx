import { Badge } from "@/components/ui/badge";
import type { ActionStatus, ApprovalStatus, MeetingStatus } from "@/lib/types/database";

const MEETING: Record<MeetingStatus, { label: string; variant: "muted" | "warning" | "success" | "destructive" | "accent" }> = {
  uploaded: { label: "Uploaded", variant: "muted" },
  transcribing: { label: "Transcribing", variant: "warning" },
  transcribed: { label: "Transcribed", variant: "accent" },
  summarizing: { label: "Summarizing", variant: "warning" },
  ready: { label: "Ready", variant: "success" },
  failed: { label: "Failed", variant: "destructive" },
};

export function MeetingStatusBadge({ status }: { status: MeetingStatus }) {
  const s = MEETING[status];
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

const ACTION: Record<ActionStatus, { label: string; variant: "warning" | "success" | "muted" }> = {
  open: { label: "Open", variant: "warning" },
  done: { label: "Done", variant: "success" },
  dismissed: { label: "Dismissed", variant: "muted" },
};

export function ActionStatusBadge({ status }: { status: ActionStatus }) {
  const s = ACTION[status];
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

const APPROVAL: Record<ApprovalStatus, { label: string; variant: "warning" | "success" | "destructive" }> = {
  pending: { label: "Pending review", variant: "warning" },
  approved: { label: "Approved", variant: "success" },
  rejected: { label: "Rejected", variant: "destructive" },
};

export function ApprovalStatusBadge({ status }: { status: ApprovalStatus }) {
  const s = APPROVAL[status];
  return <Badge variant={s.variant}>{s.label}</Badge>;
}
