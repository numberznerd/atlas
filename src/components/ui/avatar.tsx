import * as React from "react";
import { cn } from "@/lib/utils";

/** Simple initials avatar (no image upload in MVP). */
function Avatar({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary",
        className,
      )}
    >
      {name}
    </span>
  );
}

export { Avatar };
