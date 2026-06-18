import { requireFirm } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/app/sidebar";
import { Topbar } from "@/components/app/topbar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, firm } = await requireFirm();

  const supabase = await createClient();
  const { count: pendingApprovals } = await supabase
    .from("approval_queue")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  const isAdmin = profile.role === "admin";

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar isAdmin={isAdmin} pendingApprovals={pendingApprovals ?? 0} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar
          firmName={firm.name}
          residencyTier={firm.residency_tier}
          userName={profile.full_name || profile.email}
          role={profile.role}
        />
        <main className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="mx-auto max-w-6xl px-5 py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
