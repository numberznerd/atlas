import Link from "next/link";
import { Mic, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { MeetingStatusBadge } from "@/components/status-badge";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Meetings — Atlas" };

export default async function MeetingsPage() {
  const supabase = await createClient();
  const { data: meetings } = await supabase
    .from("meetings")
    .select("id, title, status, occurred_at, created_at, client:clients(name)")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Meetings"
        description="Upload client conversations; Atlas transcribes, summarizes, and remembers."
        action={
          <Button asChild>
            <Link href="/meetings/new">
              <Upload className="size-4" /> Upload meeting
            </Link>
          </Button>
        }
      />

      {meetings && meetings.length > 0 ? (
        <Card className="divide-y divide-border overflow-hidden">
          {meetings.map((m) => {
            const client = m.client as unknown as { name: string } | null;
            return (
              <Link
                key={m.id}
                href={`/meetings/${m.id}`}
                className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-muted/50"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{m.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {client?.name ?? "Unassigned"} · {formatDate(m.occurred_at ?? m.created_at)}
                  </p>
                </div>
                <MeetingStatusBadge status={m.status} />
              </Link>
            );
          })}
        </Card>
      ) : (
        <EmptyState
          icon={Mic}
          title="No meetings yet"
          description="Upload your first client conversation to start building firm memory."
          action={
            <Button asChild>
              <Link href="/meetings/new">
                <Upload className="size-4" /> Upload meeting
              </Link>
            </Button>
          }
        />
      )}
    </div>
  );
}
