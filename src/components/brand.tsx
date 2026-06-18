import Link from "next/link";
import { cn } from "@/lib/utils";

/** Atlas wordmark + mark. */
export function Logo({
  href = "/",
  className,
  showWord = true,
}: {
  href?: string;
  className?: string;
  showWord?: boolean;
}) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2", className)}>
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden>
          <path
            d="M12 3l7 4v6c0 4-3 6.5-7 8-4-1.5-7-4-7-8V7l7-4z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {showWord ? (
        <span className="text-lg font-semibold tracking-tight text-foreground">Atlas</span>
      ) : null}
    </Link>
  );
}
