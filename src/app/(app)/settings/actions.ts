"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, logAudit } from "@/lib/auth";
import type { ResidencyTier, UserRole } from "@/lib/types/database";

export interface SettingsFormState {
  error?: string;
  success?: string;
}

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user?.profile.firm_id) redirect("/login");
  if (user.profile.role !== "admin") return null;
  return user;
}

export async function updateFirmAction(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const user = await requireAdmin();
  if (!user?.profile.firm_id) return { error: "Only admins can change workspace settings." };

  const name = String(formData.get("name") ?? "").trim();
  const residency = String(formData.get("residency_tier") ?? "managed") as ResidencyTier;
  const retention = Number(formData.get("retention_months") ?? 84);

  if (name.length < 2) return { error: "Firm name is required." };
  if (retention < 72) return { error: "Retention must be at least 72 months to honour CRA's 6-year rule." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("firms")
    .update({
      name,
      residency_tier: residency === "canada_only" ? "canada_only" : "managed",
      retention_months: retention,
    })
    .eq("id", user.profile.firm_id);

  if (error) return { error: error.message };
  await logAudit("firm.updated", { targetType: "firm", targetId: user.profile.firm_id });
  revalidatePath("/settings");
  return { success: "Workspace settings saved." };
}

export async function inviteMemberAction(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const user = await requireAdmin();
  if (!user?.profile.firm_id) return { error: "Only admins can invite members." };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "member") as UserRole;
  if (!email.includes("@")) return { error: "Enter a valid email." };

  const supabase = await createClient();
  const { error } = await supabase.from("invitations").upsert(
    {
      firm_id: user.profile.firm_id,
      email,
      role: role === "admin" || role === "lite" ? role : "member",
      status: "pending",
      invited_by: user.authId,
    },
    { onConflict: "firm_id,email" },
  );

  if (error) return { error: error.message };
  await logAudit("member.invited", { payload: { email, role } });
  revalidatePath("/settings");
  return { success: `Invitation ready for ${email}. They'll join automatically when they sign up with this email.` };
}

export async function revokeInvitationAction(formData: FormData) {
  const user = await requireAdmin();
  if (!user) return;
  const id = String(formData.get("id"));
  const supabase = await createClient();
  await supabase.from("invitations").update({ status: "revoked" }).eq("id", id);
  revalidatePath("/settings");
}

export async function updateMemberRoleAction(formData: FormData) {
  const user = await requireAdmin();
  if (!user) return;
  const id = String(formData.get("id"));
  const role = String(formData.get("role")) as UserRole;
  const supabase = await createClient();
  await supabase.from("users").update({ role }).eq("id", id);
  await logAudit("member.role_changed", { targetType: "user", targetId: id, payload: { role } });
  revalidatePath("/settings");
}
