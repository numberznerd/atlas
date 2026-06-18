import { redirect } from "next/navigation";
import { History, Users2 } from "lucide-react";
import { requireFirm } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { revokeInvitationAction, updateMemberRoleAction } from "@/app/(app)/settings/actions";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Avatar } from "@/components/ui/avatar";
import { WorkspaceForm } from "@/app/(app)/settings/workspace-form";
import { InviteForm } from "@/app/(app)/settings/invite-form";
import { initials, timeAgo } from "@/lib/utils";

export const metadata = { title: "Settings — Atlas" };

export default async function SettingsPage() {
  const { profile, firm, authId } = await requireFirm();
  if (profile.role !== "admin") redirect("/dashboard");

  const supabase = await createClient();
  const [{ data: members }, { data: invitations }, { data: audit }] = await Promise.all([
    supabase.from("users").select("id, email, full_name, role, status").order("created_at"),
    supabase
      .from("invitations")
      .select("id, email, role, status, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
    supabase
      .from("audit_log")
      .select("id, event_type, target_type, created_at, actor_user_id")
      .order("created_at", { ascending: false })
      .limit(40),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Workspace, team, and compliance controls." />

      {/* Workspace */}
      <Card>
        <CardHeader>
          <CardTitle>Workspace</CardTitle>
          <CardDescription>Firm name, data residency, and retention policy.</CardDescription>
        </CardHeader>
        <CardContent>
          <WorkspaceForm
            name={firm.name}
            residencyTier={firm.residency_tier}
            retentionMonths={firm.retention_months}
          />
        </CardContent>
      </Card>

      {/* Members */}
      <Card>
        <CardHeader className="flex-row items-center gap-2">
          <Users2 className="size-4 text-muted-foreground" />
          <CardTitle>Team</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <InviteForm />

          <div className="divide-y divide-border">
            {(members ?? []).map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-3 py-3">
                <div className="flex items-center gap-3">
                  <Avatar name={initials(m.full_name || m.email)} />
                  <div>
                    <p className="text-sm font-medium text-foreground">{m.full_name || m.email}</p>
                    <p className="text-xs text-muted-foreground">{m.email}</p>
                  </div>
                </div>
                {m.id === authId ? (
                  <Badge variant="secondary" className="capitalize">{m.role ?? "—"} · you</Badge>
                ) : (
                  <form action={updateMemberRoleAction} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={m.id} />
                    <Select name="role" defaultValue={m.role ?? "member"} className="w-32">
                      <option value="admin">Admin</option>
                      <option value="member">Member</option>
                      <option value="lite">Lite</option>
                    </Select>
                    <Button type="submit" size="sm" variant="ghost">Update</Button>
                  </form>
                )}
              </div>
            ))}
          </div>

          {invitations && invitations.length > 0 ? (
            <div>
              <p className="mb-2 text-sm font-medium text-foreground">Pending invitations</p>
              <div className="divide-y divide-border">
                {invitations.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between py-2.5">
                    <div className="text-sm">
                      <span className="text-foreground">{inv.email}</span>{" "}
                      <Badge variant="muted" className="capitalize">{inv.role}</Badge>
                    </div>
                    <form action={revokeInvitationAction}>
                      <input type="hidden" name="id" value={inv.id} />
                      <Button type="submit" size="sm" variant="ghost">Revoke</Button>
                    </form>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Audit log */}
      <Card>
        <CardHeader className="flex-row items-center gap-2">
          <History className="size-4 text-muted-foreground" />
          <CardTitle>Audit log</CardTitle>
          <CardDescription className="ml-auto">PIPEDA accountability — last 40 events</CardDescription>
        </CardHeader>
        <CardContent>
          {audit && audit.length > 0 ? (
            <div className="divide-y divide-border text-sm">
              {audit.map((e) => (
                <div key={e.id} className="flex items-center justify-between py-2">
                  <span className="font-mono text-xs text-foreground">{e.event_type}</span>
                  <span className="text-xs text-muted-foreground">
                    {e.target_type ? `${e.target_type} · ` : ""}
                    {timeAgo(e.created_at)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No events recorded yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
