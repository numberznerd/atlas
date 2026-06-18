import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AppUser, Firm } from "@/lib/types/database";

export interface CurrentUser {
  authId: string;
  email: string;
  profile: AppUser;
  firm: Firm | null;
}

/**
 * Loads the signed-in user and their firm profile, or null if not signed in.
 * Used by Server Components and Server Actions.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) {
    // Auth user exists but the profile row hasn't propagated yet.
    return {
      authId: user.id,
      email: user.email ?? "",
      profile: {
        id: user.id,
        firm_id: null,
        email: user.email ?? "",
        full_name: (user.user_metadata?.full_name as string) ?? null,
        role: null,
        status: "active",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      firm: null,
    };
  }

  let firm: Firm | null = null;
  if (profile.firm_id) {
    const { data } = await supabase.from("firms").select("*").eq("id", profile.firm_id).single();
    firm = data ?? null;
  }

  return { authId: user.id, email: user.email ?? "", profile, firm };
}

/** Require a signed-in user; redirect to /login otherwise. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Require a signed-in user who belongs to a firm. Sends users without a firm
 * to onboarding (PRD §6.1: firm sign-up creates the workspace).
 */
export async function requireFirm(): Promise<CurrentUser & { firm: Firm }> {
  const user = await requireUser();
  if (!user.firm || !user.profile.firm_id) redirect("/onboarding");
  return user as CurrentUser & { firm: Firm };
}

/** Record a sensitive event in the audit log (PRD §6.1 F-1.5). */
export async function logAudit(
  eventType: string,
  opts: { targetType?: string; targetId?: string; payload?: Record<string, unknown> } = {},
) {
  const supabase = await createClient();
  await supabase.rpc("log_audit_event", {
    p_event_type: eventType,
    p_target_type: opts.targetType ?? null,
    p_target_id: opts.targetId ?? null,
    p_payload: opts.payload ?? {},
  });
}
