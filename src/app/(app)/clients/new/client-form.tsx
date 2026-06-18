"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { createClientAction, type ClientFormState } from "@/app/(app)/clients/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const ENGAGEMENTS = ["tax", "bookkeeping", "advisory", "audit", "payroll"];
const initial: ClientFormState = {};

export function NewClientForm({ isAdmin }: { isAdmin: boolean }) {
  const [state, formAction, pending] = useActionState(createClientAction, initial);

  return (
    <form action={formAction} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="name">Client name</Label>
          <Input id="name" name="name" placeholder="Browns Manufacturing Ltd." required autoFocus />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="type">Type</Label>
          <Select id="type" name="type" defaultValue="corporation">
            <option value="individual">Individual</option>
            <option value="corporation">Corporation</option>
            <option value="partnership">Partnership</option>
            <option value="trust">Trust</option>
            <option value="nonprofit">Non-profit</option>
            <option value="other">Other</option>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="fiscal_year_end">Fiscal year-end</Label>
          <Input id="fiscal_year_end" name="fiscal_year_end" placeholder="12-31" />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Engagement types</Label>
        <div className="flex flex-wrap gap-2">
          {ENGAGEMENTS.map((e) => (
            <label
              key={e}
              className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm capitalize has-[:checked]:border-primary has-[:checked]:bg-primary/5"
            >
              <input type="checkbox" name="engagement_types" value={e} />
              {e}
            </label>
          ))}
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="contact_name">Primary contact</Label>
          <Input id="contact_name" name="contact_name" placeholder="Sam Brown" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contact_email">Contact email</Label>
          <Input id="contact_email" name="contact_email" type="email" placeholder="sam@browns.ca" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" placeholder="Anything the team should know about this client…" />
      </div>

      {isAdmin ? (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="is_restricted" />
          Restrict access — only admins and assigned members can see this client
        </label>
      ) : null}

      {state.error ? (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          Create client
        </Button>
      </div>
    </form>
  );
}
