import Link from "next/link";
import { CheckSquare, Plus, ShieldCheck } from "lucide-react";
import { requireFirm } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { reviewApprovalAction } from "@/app/(app)/approvals/actions";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/empty-state";
import { ApprovalStatusBadge } from "@/components/status-badge";
import { CopyButton } from "@/components/copy-button";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Approvals — Atlas" };

const ACTION_LABEL: Record<string, string> = {
  email_draft: "Email draft",
  client_message: "Client message",
  external_task: "External task",
};

export default async function ApprovalsPage() {
  const { profile } = await requireFirm();
  const isAdmin = profile.role === "admin";
  const supabase = await createClient();

  const { data: approvals } = await supabase
    .from("approval_queue")
    .select("*, client:clients(name)")
    .order("status")
    .order("created_at", { ascending: false });

  const pending = (approvals ?? []).filter((a) => a.status === "pending");
  const reviewed = (approvals ?? []).filter((a) => a.status !== "pending");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approvals"
        description="Nothing leaves the firm without a human. The AI drafts; you approve, edit, or reject."
        action={
          <Button asChild>
            <Link href="/approvals/new">
              <Plus className="size-4" /> New draft
            </Link>
          </Button>
        }
      />

      <div className="flex items-start gap-3 rounded-lg border border-accent/30 bg-accent/5 px-4 py-3 text-sm">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent" />
        <p className="text-muted-foreground">
          This is the trust gate. Approving a draft does <span className="font-medium text-foreground">not</span> send
          it — Atlas never sends or executes anything in the MVP. Approved drafts are ready for you to copy out. Every
          decision is recorded in the audit log.
        </p>
      </div>

      {/* Pending */}
      <Card>
        <CardHeader>
          <CardTitle>Pending review ({pending.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {pending.length === 0 ? (
            <EmptyState icon={CheckSquare} title="Nothing to review" description="Drafts awaiting approval will appear here." />
          ) : (
            pending.map((a) => {
              const client = a.client as unknown as { name: string } | null;
              const draft = a.draft_content;
              return (
                <div key={a.id} className="rounded-lg border border-border p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{ACTION_LABEL[a.action_type] ?? a.action_type}</Badge>
                      {client ? <span className="text-sm text-muted-foreground">{client.name}</span> : null}
                    </div>
                    <ApprovalStatusBadge status={a.status} />
                  </div>
                  {draft.subject ? (
                    <p className="mt-3 text-sm font-medium text-foreground">{draft.subject}</p>
                  ) : null}
                  <p className="mt-1 whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-sm text-foreground">
                    {draft.body}
                  </p>
                  {isAdmin ? (
                    <form action={reviewApprovalAction} className="mt-3 space-y-2">
                      <input type="hidden" name="id" value={a.id} />
                      <Textarea name="review_note" placeholder="Optional note…" className="min-h-[44px]" />
                      <div className="flex gap-2">
                        <Button type="submit" name="decision" value="approved" variant="accent" size="sm">
                          Approve
                        </Button>
                        <Button type="submit" name="decision" value="rejected" variant="outline" size="sm">
                          Reject
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <p className="mt-3 text-xs text-muted-foreground">Awaiting an admin&apos;s review.</p>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Reviewed */}
      {reviewed.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Reviewed</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {reviewed.map((a) => {
              const client = a.client as unknown as { name: string } | null;
              return (
                <div key={a.id} className="rounded-lg border border-border p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{ACTION_LABEL[a.action_type] ?? a.action_type}</Badge>
                      {client ? <span className="text-sm text-muted-foreground">{client.name}</span> : null}
                    </div>
                    <ApprovalStatusBadge status={a.status} />
                  </div>
                  {a.draft_content.subject ? (
                    <p className="mt-3 text-sm font-medium text-foreground">{a.draft_content.subject}</p>
                  ) : null}
                  <p className="mt-1 whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-sm text-foreground">
                    {a.draft_content.body}
                  </p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      Reviewed {formatDate(a.reviewed_at)}
                      {a.review_note ? ` · ${a.review_note}` : ""}
                    </span>
                    {a.status === "approved" ? (
                      <CopyButton
                        text={a.draft_content.subject ? `${a.draft_content.subject}\n\n${a.draft_content.body}` : a.draft_content.body}
                        label="Copy to send"
                      />
                    ) : null}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
