"use client";

import { useActionState } from "react";
import { Loader2, MapPin } from "lucide-react";
import { createFirmAction, type OnboardingState } from "@/app/onboarding/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: OnboardingState = {};

export function OnboardingForm() {
  const [state, formAction, pending] = useActionState(createFirmAction, initial);

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="name">Firm name</Label>
        <Input id="name" name="name" placeholder="Maple &amp; Co. CPA" required autoFocus />
      </div>

      <div className="space-y-2">
        <Label>Data residency</Label>
        <div className="grid gap-2">
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
            <input type="radio" name="residency_tier" value="managed" defaultChecked className="mt-1" />
            <span className="text-sm">
              <span className="font-medium text-foreground">Standard (managed transcription)</span>
              <span className="block text-muted-foreground">
                Canadian storage; transcription via a managed provider under a no-training DPA,
                disclosed to clients. Recommended for most firms.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
            <input type="radio" name="residency_tier" value="canada_only" className="mt-1" />
            <span className="text-sm">
              <span className="font-medium text-foreground">
                Canada-only <MapPin className="inline size-3.5 text-accent" />
              </span>
              <span className="block text-muted-foreground">
                In-Canada self-hosted transcription. For Québec / Law 25 or strict-residency firms.
              </span>
            </span>
          </label>
        </div>
      </div>

      {state.error ? (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
      ) : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        Create workspace
      </Button>
    </form>
  );
}
