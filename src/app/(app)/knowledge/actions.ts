"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, logAudit } from "@/lib/auth";
import { indexDocument } from "@/lib/ai/indexing";

export interface SopFormState {
  error?: string;
}

/** Create and index a firm SOP / procedure document (PRD §6.6 F-6.1). */
export async function createSopAction(_prev: SopFormState, formData: FormData): Promise<SopFormState> {
  const user = await getCurrentUser();
  if (!user?.profile.firm_id) redirect("/login");

  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  if (title.length < 2) return { error: "Give the procedure a title." };
  if (content.length < 20) return { error: "Add the procedure text so Atlas can index it." };

  const supabase = await createClient();
  try {
    const documentId = await indexDocument(supabase, {
      firmId: user.profile.firm_id,
      clientId: null, // firm-wide SOP
      type: "sop",
      title,
      text: content,
      uploadedBy: user.authId,
    });
    await logAudit("sop.indexed", { targetType: "document", targetId: documentId, payload: { title } });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not index the document." };
  }

  redirect("/knowledge");
}
