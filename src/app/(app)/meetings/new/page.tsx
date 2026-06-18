import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireFirm } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { UploadForm } from "@/app/(app)/meetings/new/upload-form";

export const metadata = { title: "Upload meeting — Atlas" };

export default async function NewMeetingPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const { firm } = await requireFirm();
  const { client } = await searchParams;
  const supabase = await createClient();
  const { data: clients } = await supabase.from("clients").select("id, name").order("name");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href="/meetings"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to meetings
      </Link>
      <PageHeader
        title="Upload meeting"
        description="Audio is stored in Canada. Transcription respects your firm's residency tier."
      />
      <Card>
        <CardContent className="pt-5">
          <UploadForm firmId={firm.id} clients={clients ?? []} defaultClientId={client} />
        </CardContent>
      </Card>
    </div>
  );
}
