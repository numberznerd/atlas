import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireFirm } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { NewClientForm } from "@/app/(app)/clients/new/client-form";

export const metadata = { title: "New client — Atlas" };

export default async function NewClientPage() {
  const { profile } = await requireFirm();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href="/clients" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Back to clients
      </Link>
      <PageHeader title="New client" description="Create a client profile to anchor meetings and follow-ups." />
      <Card>
        <CardContent className="pt-5">
          <NewClientForm isAdmin={profile.role === "admin"} />
        </CardContent>
      </Card>
    </div>
  );
}
