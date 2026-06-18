"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ResidencyTier } from "@/lib/types/database";

export interface OnboardingState {
  error?: string;
}

export async function createFirmAction(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const name = String(formData.get("name") ?? "").trim();
  const residency = String(formData.get("residency_tier") ?? "managed") as ResidencyTier;

  if (name.length < 2) {
    return { error: "Please enter your firm's name." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.rpc("create_firm", {
    p_name: name,
    p_residency_tier: residency === "canada_only" ? "canada_only" : "managed",
  });

  if (error) {
    return { error: error.message };
  }

  redirect("/dashboard");
}
