"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, logAudit } from "@/lib/auth";
import type { ApprovalActionType } from "@/lib/types/database";

export interface DraftFormState {
  error?: string;
}

const TYPES: ApprovalActionType[] = ["email_draft", "client_message", "external_task"];

/** Member drafts an external action; it lands in the queue as pending. */
export async function createDraftAction(
  _prev: DraftFormState,
  formData: FormData,
): Promise<DraftFormState> {
  const user = await getCurrentUser();
  if (!user?.profile.firm_id) redirect("/login");

  const typeRaw = String(formData.get("action_type") ?? "email_draft");
  const actionType = (TYPES.includes(typeRaw as ApprovalActionType) ? typeRaw : "email_draft") as ApprovalActionType;
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const recipient = String(formData.get("recipient") ?? "").trim();
  const clientId = String(formData.get("related_client_id") ?? "") || null;

  if (body.length < 5) return { error: "Add the draft content." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("approval_queue")
    .insert({
      firm_id: user.profile.firm_id,
      action_type: actionType,
      draft_content: { subject: subject || undefined, body, recipient: recipient || undefined },
      related_client_id: clientId,
      status: "pending",
      created_by: user.authId,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  await logAudit("approval.drafted", { targetType: "approval", targetId: data.id, payload: { action_type: actionType } });
  redirect("/approvals");
}

/** Admin approves or rejects a pending draft. Nothing is ever auto-sent. */
export async function reviewApprovalAction(formData: FormData) {
  const id = String(formData.get("id"));
  const decision = String(formData.get("decision")) as "approved" | "rejected";
  const note = String(formData.get("review_note") ?? "").trim() || null;

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { error } = await supabase
    .from("approval_queue")
    .update({
      status: decision,
      reviewed_by: user.authId,
      reviewed_at: new Date().toISOString(),
      review_note: note,
    })
    .eq("id", id);

  if (!error) {
    await logAudit(`approval.${decision}`, { targetType: "approval", targetId: id });
    revalidatePath("/approvals");
  }
}
