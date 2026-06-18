import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireFirm } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { SopForm } from "@/app/(app)/knowledge/new/sop-form";

export const metadata = { title: "Add procedure — Atlas" };

export default async function NewSopPage() {
  await requireFirm();
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href="/knowledge"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Knowledge base
      </Link>
      <PageHeader
        title="Add a firm procedure"
        description="Internal SOPs are the layer horizontal tools don't have. This is what lets staff ask 'how do we do X here?'"
      />
      <Card>
        <CardContent className="pt-5">
          <SopForm />
        </CardContent>
      </Card>
    </div>
  );
}
