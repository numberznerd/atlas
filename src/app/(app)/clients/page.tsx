import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Clients — Atlas" };

const TYPE_LABEL: Record<string, string> = {
  individual: "Individual",
  corporation: "Corporation",
  partnership: "Partnership",
  trust: "Trust",
  nonprofit: "Non-profit",
  other: "Other",
};

export default async function ClientsPage() {
  const supabase = await createClient();
  const { data: clients } = await supabase
    .from("clients")
    .select("id, name, type, engagement_types, fiscal_year_end, is_restricted, updated_at")
    .order("name");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        description="Every client's history, commitments, and quirks in one place."
        action={
          <Button asChild>
            <Link href="/clients/new">
              <Plus className="size-4" /> New client
            </Link>
          </Button>
        }
      />

      {clients && clients.length > 0 ? (
        <Card className="divide-y divide-border overflow-hidden">
          {clients.map((c) => (
            <Link
              key={c.id}
              href={`/clients/${c.id}`}
              className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-muted/50"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium text-foreground">{c.name}</p>
                  {c.is_restricted ? <Badge variant="muted">Restricted</Badge> : null}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {TYPE_LABEL[c.type]}
                  {c.fiscal_year_end ? ` · FYE ${c.fiscal_year_end}` : ""} · updated{" "}
                  {formatDate(c.updated_at)}
                </p>
              </div>
              <div className="hidden flex-wrap justify-end gap-1.5 sm:flex">
                {c.engagement_types.map((e) => (
                  <Badge key={e} variant="secondary">
                    {e}
                  </Badge>
                ))}
              </div>
            </Link>
          ))}
        </Card>
      ) : (
        <EmptyState
          icon={Users}
          title="No clients yet"
          description="Add your first client, or upload a meeting and Atlas will suggest creating one."
          action={
            <Button asChild>
              <Link href="/clients/new">
                <Plus className="size-4" /> New client
              </Link>
            </Button>
          }
        />
      )}
    </div>
  );
}
