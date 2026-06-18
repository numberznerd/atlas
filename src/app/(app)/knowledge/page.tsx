import Link from "next/link";
import { Library, Plus, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { searchKnowledge } from "@/lib/ai/knowledge";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata = { title: "Knowledge base — Atlas" };

const TYPE_LABEL: Record<string, string> = {
  sop: "SOP",
  transcript: "Transcript",
  summary: "Summary",
  upload: "Upload",
};

export default async function KnowledgePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await createClient();

  const documentsQuery = supabase
    .from("documents")
    .select("id, title, type, client_id, status, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  const [docsResult, search] = await Promise.all([
    documentsQuery,
    q ? searchKnowledge(supabase, { query: q, limit: 10 }).catch(() => null) : Promise.resolve(null),
  ]);

  const documents = docsResult.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Knowledge base"
        description="Meetings, summaries, and your internal SOPs — one searchable firm brain."
        action={
          <Button asChild>
            <Link href="/knowledge/new">
              <Plus className="size-4" /> Add procedure
            </Link>
          </Button>
        }
      />

      <form className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input name="q" defaultValue={q ?? ""} placeholder="Search procedures, meetings, and client history…" className="pl-9" />
        </div>
        <Button type="submit" variant="secondary">Search</Button>
      </form>

      {search ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Results for &ldquo;{q}&rdquo;</CardTitle>
            <Badge variant="muted">{search.mode === "hybrid" ? "Hybrid search" : "Keyword search"}</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {search.results.length > 0 ? (
              search.results.map((r) => (
                <div key={r.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">{r.document_title}</p>
                    <Badge variant="secondary">{TYPE_LABEL[r.document_type] ?? r.document_type}</Badge>
                  </div>
                  <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{r.content}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No matches found.</p>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Indexed documents</CardTitle>
        </CardHeader>
        <CardContent>
          {documents.length > 0 ? (
            <div className="divide-y divide-border">
              {documents.map((d) => (
                <div key={d.id} className="flex items-center justify-between py-2.5">
                  <span className="text-sm text-foreground">{d.title}</span>
                  <div className="flex items-center gap-2">
                    {d.client_id ? <Badge variant="muted">Client</Badge> : <Badge variant="accent">Firm-wide</Badge>}
                    <Badge variant="secondary">{TYPE_LABEL[d.type] ?? d.type}</Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Library}
              title="Nothing indexed yet"
              description="Add a firm procedure or process a meeting — both become searchable here."
              action={
                <Button asChild size="sm">
                  <Link href="/knowledge/new">Add procedure</Link>
                </Button>
              }
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
