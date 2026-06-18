import { requireFirm } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { ChatPanel } from "@/app/(app)/chat/chat-panel";

export const metadata = { title: "Ask Atlas — Atlas" };

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  await requireFirm();
  const { client } = await searchParams;
  const supabase = await createClient();
  const { data: clients } = await supabase.from("clients").select("id, name").order("name");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ask Atlas"
        description="Natural-language answers about any client or firm procedure — with citations."
      />
      <ChatPanel clients={clients ?? []} defaultClientId={client} />
    </div>
  );
}
