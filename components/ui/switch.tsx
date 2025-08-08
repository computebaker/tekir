"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  checked?: boolean;
}

const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(({ className, checked, ...props }, ref) => {
  return (
    <label className={cn("relative inline-flex h-6 w-12 cursor-pointer items-center", className)}>
      <input
        ref={ref}
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        {...props}
      />
      <span className="absolute inset-0 rounded-full bg-muted transition-colors peer-checked:bg-sky-500" />
      <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-6" />
    </label>
  );
});
Switch.displayName = "Switch";

export { Switch };
