"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Mic, MessagesSquare, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/meetings/new", label: "Record", icon: Mic, primary: true },
  { href: "/chat", label: "Ask", icon: MessagesSquare },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-border bg-card md:hidden">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium",
              active ? "text-primary" : "text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "flex size-9 items-center justify-center rounded-full",
                item.primary
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : active
                    ? "bg-primary/10"
                    : "",
              )}
            >
              <item.icon className="size-5" />
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
