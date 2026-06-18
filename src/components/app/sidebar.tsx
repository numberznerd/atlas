"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CheckSquare,
  LayoutDashboard,
  MessagesSquare,
  Mic,
  Library,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Logo } from "@/components/brand";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/meetings", label: "Meetings", icon: Mic },
  { href: "/knowledge", label: "Knowledge base", icon: Library },
  { href: "/chat", label: "Ask Atlas", icon: MessagesSquare },
  { href: "/approvals", label: "Approvals", icon: CheckSquare },
];

export function Sidebar({ isAdmin, pendingApprovals }: { isAdmin: boolean; pendingApprovals: number }) {
  const pathname = usePathname();

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-card md:flex">
      <div className="flex h-16 items-center border-b border-border px-5">
        <Logo href="/dashboard" />
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {nav.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <span className="flex items-center gap-3">
                <item.icon className="size-4" />
                {item.label}
              </span>
              {item.href === "/approvals" && pendingApprovals > 0 ? (
                <span className="flex size-5 items-center justify-center rounded-full bg-warning/15 text-[11px] font-semibold text-warning">
                  {pendingApprovals}
                </span>
              ) : null}
            </Link>
          );
        })}

        {isAdmin ? (
          <Link
            href="/settings"
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive("/settings")
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Settings className="size-4" />
            Settings
          </Link>
        ) : null}
      </nav>

      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          <ShieldCheck className="size-4 text-accent" />
          <span>Data resident in Canada</span>
        </div>
      </div>
    </aside>
  );
}
