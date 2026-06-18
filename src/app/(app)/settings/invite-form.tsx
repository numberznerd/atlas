"use client";

import { useActionState } from "react";
import { Loader2, UserPlus } from "lucide-react";
import { inviteMemberAction, type SettingsFormState } from "@/app/(app)/settings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

const initial: SettingsFormState = {};

export function InviteForm() {
  const [state, formAction, pending] = useActionState(inviteMemberAction, initial);

  return (
    <form action={formAction} className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input name="email" type="email" placeholder="teammate@firm.ca" required className="flex-1" />
        <Select name="role" defaultValue="member" className="sm:w-40">
          <option value="member">Member</option>
          <option value="admin">Admin</option>
          <option value="lite">Lite (read-only)</option>
        </Select>
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
          Invite
        </Button>
      </div>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-success">{state.success}</p> : null}
    </form>
  );
}
