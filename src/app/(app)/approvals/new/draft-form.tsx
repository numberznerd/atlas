"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { createDraftAction, type DraftFormState } from "@/app/(app)/approvals/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const initial: DraftFormState = {};

export function DraftForm({ clients }: { clients: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState(createDraftAction, initial);

  return (
    <form action={formAction} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="action_type">Type</Label>
          <Select id="action_type" name="action_type" defaultValue="email_draft">
            <option value="email_draft">Email draft</option>
            <option value="client_message">Client message</option>
            <option value="external_task">External task</option>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="related_client_id">Client</Label>
          <Select id="related_client_id" name="related_client_id" defaultValue="">
            <option value="">None</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="recipient">Recipient (optional)</Label>
          <Input id="recipient" name="recipient" placeholder="sam@browns.ca" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="subject">Subject (optional)</Label>
          <Input id="subject" name="subject" placeholder="Follow-up: SR&ED documentation" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="body">Draft content</Label>
        <Textarea
          id="body"
          name="body"
          className="min-h-[200px]"
          placeholder="Write or paste the draft. An admin reviews it before it can be sent — Atlas never sends anything itself."
          required
        />
      </div>

      {state.error ? (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        Submit for approval
      </Button>
    </form>
  );
}
