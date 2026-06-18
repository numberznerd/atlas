import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, FileText, Mic, Sparkles, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { setActionItemStatus } from "@/app/(app)/clients/actions";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/ui/empty-state";
import { MeetingStatusBadge } from "@/components/status-badge";
import { formatDate } from "@/lib/utils";
import type { Contact } from "@/lib/types/database";

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: client } = await supabase.from("clients").select("*").eq("id", id).single();
  if (!client) notFound();

  const [{ data: meetings }, { data: actions }, { data: documents }] = await Promise.all([
    supabase
      .from("meetings")
      .select("id, title, status, occurred_at, created_at")
      .eq("client_id", id)
      .order("occurred_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("action_items")
      .select("id, description, due_date, owner_type, status")
      .eq("client_id", id)
      .order("status")
      .order("due_date", { ascending: true, nullsFirst: false }),
    supabase
      .from("documents")
      .select("id, title, type, created_at")
      .eq("client_id", id)
      .order("created_at", { ascending: false }),
  ]);

  const contacts = (client.contacts ?? []) as Contact[];
  const openActions = (actions ?? []).filter((a) => a.status === "open");

  return (
    <div className="space-y-6">
      <Link
        href="/clients"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Clients
      </Link>

      <PageHeader
        title={client.name}
        description={contacts[0] ? `${contacts[0].name}${contacts[0].email ? ` · ${contacts[0].email}` : ""}` : undefined}
        action={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href={`/chat?client=${client.id}`}>
                <Sparkles className="size-4" /> Ask about this client
              </Link>
            </Button>
            <Button asChild>
              <Link href={`/meetings/new?client=${client.id}`}>
                <Upload className="size-4" /> Upload meeting
              </Link>
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="capitalize">{client.type}</Badge>
        {client.fiscal_year_end ? <Badge variant="muted">FYE {client.fiscal_year_end}</Badge> : null}
        {client.engagement_types.map((e) => (
          <Badge key={e} variant="secondary">{e}</Badge>
        ))}
        {client.is_restricted ? <Badge variant="warning">Restricted</Badge> : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: brief + timeline */}
        <div className="space-y-6 lg:col-span-2">
          {/* Client brief — the new-hire onboarding artifact (PRD §6.2 F-2.4) */}
          <Card>
            <CardHeader className="flex-row items-center gap-2">
              <Sparkles className="size-4 text-accent" />
              <CardTitle>Client brief</CardTitle>
            </CardHeader>
            <CardContent>
              {client.notes ? (
                <p className="text-sm leading-relaxed text-foreground">{client.notes}</p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No notes yet. As meetings are processed, this brief becomes the rolling summary a
                  new hire can read to get up to speed on {client.name}.
                </p>
              )}
              <Separator className="my-4" />
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-muted-foreground">Meetings</dt>
                  <dd className="font-medium text-foreground">{meetings?.length ?? 0}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Open follow-ups</dt>
                  <dd className="font-medium text-foreground">{openActions.length}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              {meetings && meetings.length > 0 ? (
                <ol className="relative space-y-4 border-l border-border pl-5">
                  {meetings.map((m) => (
                    <li key={m.id} className="relative">
                      <span className="absolute -left-[1.42rem] top-1.5 flex size-3 items-center justify-center rounded-full border-2 border-card bg-primary" />
                      <Link href={`/meetings/${m.id}`} className="group block">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-foreground group-hover:underline">{m.title}</p>
                          <MeetingStatusBadge status={m.status} />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(m.occurred_at ?? m.created_at)}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ol>
              ) : (
                <EmptyState
                  icon={Mic}
                  title="No meetings yet"
                  description="Upload a conversation to start this client's timeline."
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: follow-ups + documents */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex-row items-center gap-2">
              <CalendarClock className="size-4 text-muted-foreground" />
              <CardTitle>Follow-ups</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {actions && actions.length > 0 ? (
                actions.map((a) => {
                  const overdue = a.status === "open" && a.due_date && new Date(a.due_date) < new Date();
                  return (
                    <div key={a.id} className="rounded-lg border border-border p-3">
                      <p className={a.status === "done" ? "text-sm text-muted-foreground line-through" : "text-sm text-foreground"}>
                        {a.description}
                      </p>
                      <div className="mt-1 flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {a.owner_type === "client" ? "Client" : "Firm"}
                          {a.due_date ? (
                            <>
                              {" · "}
                              <span className={overdue ? "font-medium text-destructive" : ""}>
                                {formatDate(a.due_date)}
                              </span>
                            </>
                          ) : null}
                        </span>
                        {a.status === "open" ? (
                          <div className="flex gap-1">
                            <form action={setActionItemStatus}>
                              <input type="hidden" name="id" value={a.id} />
                              <input type="hidden" name="status" value="done" />
                              <Button type="submit" size="sm" variant="ghost">Done</Button>
                            </form>
                            <form action={setActionItemStatus}>
                              <input type="hidden" name="id" value={a.id} />
                              <input type="hidden" name="status" value="dismissed" />
                              <Button type="submit" size="sm" variant="ghost">Dismiss</Button>
                            </form>
                          </div>
                        ) : (
                          <Badge variant={a.status === "done" ? "success" : "muted"}>{a.status}</Badge>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground">No follow-ups for this client yet.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center gap-2">
              <FileText className="size-4 text-muted-foreground" />
              <CardTitle>Documents</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {documents && documents.length > 0 ? (
                documents.map((d) => (
                  <div key={d.id} className="flex items-center justify-between text-sm">
                    <span className="truncate text-foreground">{d.title}</span>
                    <Badge variant="muted">{d.type}</Badge>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No documents indexed for this client.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
