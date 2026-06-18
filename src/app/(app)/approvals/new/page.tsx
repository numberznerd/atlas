import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireFirm } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { DraftForm } from "@/app/(app)/approvals/new/draft-form";

export const metadata = { title: "New draft — Atlas" };

export default async function NewDraftPage() {
  await requireFirm();
  const supabase = await createClient();
  const { data: clients } = await supabase.from("clients").select("id, name").order("name");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href="/approvals"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Approvals
      </Link>
      <PageHeader title="New draft" description="Draft an external action. It won't leave the firm until an admin approves it." />
      <Card>
        <CardContent className="pt-5">
          <DraftForm clients={clients ?? []} />
        </CardContent>
      </Card>
    </div>
  );
}
