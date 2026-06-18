import { LogOut } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { initials } from "@/lib/utils";
import type { ResidencyTier, UserRole } from "@/lib/types/database";

const ROLE_LABEL: Record<UserRole, string> = {
  admin: "Admin",
  member: "Member",
  lite: "Lite",
};

export function Topbar({
  firmName,
  residencyTier,
  userName,
  role,
}: {
  firmName: string;
  residencyTier: ResidencyTier;
  userName: string;
  role: UserRole | null;
}) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-card px-5">
      <div className="flex items-center gap-3">
        <span className="font-semibold text-foreground">{firmName}</span>
        {residencyTier === "canada_only" ? (
          <Badge variant="accent">Canada-only</Badge>
        ) : (
          <Badge variant="muted">Standard residency</Badge>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden text-right sm:block">
          <p className="text-sm font-medium leading-tight text-foreground">{userName}</p>
          <p className="text-xs text-muted-foreground">{role ? ROLE_LABEL[role] : ""}</p>
        </div>
        <Avatar name={initials(userName)} />
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut className="size-4" />
          </button>
        </form>
      </div>
    </header>
  );
}
