import Link from "next/link";
import { CheckSquare, Clock, Mic, Upload, Users } from "lucide-react";
import { requireFirm } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/app/stat-card";
import { AiStatusBanner } from "@/components/app/ai-status-banner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { MeetingStatusBadge } from "@/components/status-badge";
import { formatDate, timeAgo } from "@/lib/utils";

export const metadata = { title: "Dashboard — Atlas" };

export default async function DashboardPage() {
  const { profile } = await requireFirm();
  const supabase = await createClient();

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [clients, meetingsThisMonth, openActions, pendingApprovals, recentMeetings, myFollowups] =
    await Promise.all([
      supabase.from("clients").select("id", { count: "exact", head: true }),
      supabase
        .from("meetings")
        .select("id", { count: "exact", head: true })
        .gte("created_at", monthStart.toISOString()),
      supabase.from("action_items").select("id", { count: "exact", head: true }).eq("status", "open"),
      supabase.from("approval_queue").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase
        .from("meetings")
        .select("id, title, status, occurred_at, created_at, client:clients(name)")
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("action_items")
        .select("id, description, due_date, owner_type, client:clients(id, name)")
        .eq("status", "open")
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(6),
    ]);

  const firstName = (profile.full_name || profile.email).split(/[ @]/)[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description="Your firm's institutional memory at a glance."
        action={
          <Button asChild>
            <Link href="/meetings/new">
              <Upload className="size-4" /> Upload meeting
            </Link>
          </Button>
        }
      />

      <AiStatusBanner />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Clients" value={clients.count ?? 0} icon={Users} href="/clients" />
        <StatCard label="Meetings this month" value={meetingsThisMonth.count ?? 0} icon={Mic} href="/meetings" />
        <StatCard label="Open follow-ups" value={openActions.count ?? 0} icon={Clock} href="/clients" />
        <StatCard
          label="Pending approvals"
          value={pendingApprovals.count ?? 0}
          icon={CheckSquare}
          href="/approvals"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Recent meetings</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/meetings">View all</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-1">
            {recentMeetings.data && recentMeetings.data.length > 0 ? (
              recentMeetings.data.map((m) => {
                const client = m.client as unknown as { name: string } | null;
                return (
                  <Link
                    key={m.id}
                    href={`/meetings/${m.id}`}
                    className="flex items-center justify-between rounded-md px-2 py-2.5 hover:bg-muted"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{m.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {client?.name ?? "Unassigned"} · {timeAgo(m.created_at)}
                      </p>
                    </div>
                    <MeetingStatusBadge status={m.status} />
                  </Link>
                );
              })
            ) : (
              <EmptyState
                icon={Mic}
                title="No meetings yet"
                description="Upload your first client conversation to start building firm memory."
                action={
                  <Button asChild size="sm">
                    <Link href="/meetings/new">Upload meeting</Link>
                  </Button>
                }
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Follow-ups due</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/clients">View clients</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-1">
            {myFollowups.data && myFollowups.data.length > 0 ? (
              myFollowups.data.map((a) => {
                const client = a.client as unknown as { id: string; name: string } | null;
                const overdue = a.due_date && new Date(a.due_date) < new Date();
                return (
                  <div key={a.id} className="flex items-start justify-between gap-3 rounded-md px-2 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-foreground">{a.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {client ? client.name : "Firm"} ·{" "}
                        <span className={overdue ? "font-medium text-destructive" : ""}>
                          {a.due_date ? `Due ${formatDate(a.due_date)}` : "No due date"}
                        </span>
                      </p>
                    </div>
                  </div>
                );
              })
            ) : (
              <EmptyState icon={CheckSquare} title="Nothing due" description="No open follow-ups right now." />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
