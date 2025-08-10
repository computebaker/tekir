"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  checked?: boolean;
}

const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(({ className, checked, disabled, ...props }, ref) => {
  return (
    <label
      className={cn(
        "relative inline-flex h-6 w-12 items-center",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
        className
      )}
    >
      <input
        ref={ref}
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        role="switch"
        aria-checked={!!checked}
        aria-disabled={!!disabled}
        {...props}
      />
      <span
        className={cn(
          "absolute inset-0 rounded-full bg-muted transition-colors",
          "peer-checked:bg-sky-500",
          // Visible focus ring when the (sr-only) input receives focus
          "peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-sky-500 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background"
        )}
      />
      <span
        className={cn(
          "absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
          "peer-checked:translate-x-6"
        )}
      />
    </label>
  );
});
Switch.displayName = "Switch";

export { Switch };
