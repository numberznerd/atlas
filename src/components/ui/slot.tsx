import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Minimal Slot: merges the parent's props (notably className) onto a single
 * child element. Enough for our `asChild` button/link composition without
 * pulling in @radix-ui/react-slot.
 */
export const Slot = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
  ({ children, className, ...props }, ref) => {
    if (!React.isValidElement(children)) return null;
    const child = children as React.ReactElement<Record<string, unknown>>;
    const childProps = child.props;
    return React.cloneElement(child, {
      ...props,
      ...childProps,
      className: cn(className, childProps.className as string | undefined),
      ref,
    });
  },
);
Slot.displayName = "Slot";
