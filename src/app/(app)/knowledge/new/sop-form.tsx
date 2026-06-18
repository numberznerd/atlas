"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { createSopAction, type SopFormState } from "@/app/(app)/knowledge/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const initial: SopFormState = {};

export function SopForm() {
  const [state, formAction, pending] = useActionState(createSopAction, initial);

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="title">Procedure title</Label>
        <Input id="title" name="title" placeholder="How we handle SR&ED claims" required autoFocus />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="content">Procedure text</Label>
        <Textarea
          id="content"
          name="content"
          className="min-h-[260px]"
          placeholder="Paste your firm's procedure here. Atlas chunks and indexes it so staff can ask 'how do we handle X?' and get a cited answer."
          required
        />
      </div>
      {state.error ? (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        Add to knowledge base
      </Button>
    </form>
  );
}
