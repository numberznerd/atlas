"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { updateFirmAction, type SettingsFormState } from "@/app/(app)/settings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { ResidencyTier } from "@/lib/types/database";

const initial: SettingsFormState = {};

export function WorkspaceForm({
  name,
  residencyTier,
  retentionMonths,
}: {
  name: string;
  residencyTier: ResidencyTier;
  retentionMonths: number;
}) {
  const [state, formAction, pending] = useActionState(updateFirmAction, initial);

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="name">Firm name</Label>
        <Input id="name" name="name" defaultValue={name} required />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="residency_tier">Data residency tier</Label>
          <Select id="residency_tier" name="residency_tier" defaultValue={residencyTier}>
            <option value="managed">Standard (managed transcription)</option>
            <option value="canada_only">Canada-only (self-hosted STT)</option>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="retention_months">Retention (months)</Label>
          <Input
            id="retention_months"
            name="retention_months"
            type="number"
            min={72}
            defaultValue={retentionMonths}
          />
          <p className="text-xs text-muted-foreground">
            Minimum 72 (CRA 6-year rule). Records are never auto-deleted below this.
          </p>
        </div>
      </div>

      {state.error ? (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
      ) : null}
      {state.success ? (
        <p className="rounded-md bg-success/10 px-3 py-2 text-sm text-success">{state.success}</p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        Save settings
      </Button>
    </form>
  );
}
