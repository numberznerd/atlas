"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, logAudit } from "@/lib/auth";
import type { ClientType, Contact } from "@/lib/types/database";

const CLIENT_TYPES: ClientType[] = [
  "individual",
  "corporation",
  "partnership",
  "trust",
  "nonprofit",
  "other",
];

export interface ClientFormState {
  error?: string;
}

export async function createClientAction(
  _prev: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  const user = await getCurrentUser();
  if (!user?.profile.firm_id) redirect("/login");

  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 1) return { error: "Client name is required." };

  const typeRaw = String(formData.get("type") ?? "individual");
  const type = (CLIENT_TYPES.includes(typeRaw as ClientType) ? typeRaw : "individual") as ClientType;

  const engagementTypes = formData.getAll("engagement_types").map(String);
  const fiscalYearEnd = String(formData.get("fiscal_year_end") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const isRestricted = formData.get("is_restricted") === "on" && user.profile.role === "admin";

  const contactName = String(formData.get("contact_name") ?? "").trim();
  const contactEmail = String(formData.get("contact_email") ?? "").trim();
  const contacts: Contact[] = contactName
    ? [{ name: contactName, email: contactEmail || undefined, role: "Primary contact" }]
    : [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .insert({
      firm_id: user.profile.firm_id,
      name,
      type,
      engagement_types: engagementTypes,
      fiscal_year_end: fiscalYearEnd,
      contacts,
      notes,
      is_restricted: isRestricted,
      created_by: user.authId,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  await logAudit("client.created", { targetType: "client", targetId: data.id, payload: { name } });
  redirect(`/clients/${data.id}`);
}

export async function setActionItemStatus(formData: FormData) {
  const id = String(formData.get("id"));
  const status = String(formData.get("status")) as "open" | "done" | "dismissed";
  const supabase = await createClient();
  const { error } = await supabase.from("action_items").update({ status }).eq("id", id);
  if (!error) {
    await logAudit("action_item.status_changed", { targetType: "action_item", targetId: id, payload: { status } });
    revalidatePath("/clients", "layout");
    revalidatePath("/dashboard");
  }
}
