"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const inputVariants = cva(
  "flex w-full border border-border bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      size: {
        sm: "h-8 px-2 text-sm rounded-md",
        md: "h-10 px-3 text-sm rounded-md",
        lg: "h-12 px-4 text-base rounded-md",
        xl: "h-16 px-6 text-lg",
      },
      shape: {
        default: "rounded-md",
        pill: "rounded-full",
      },
    },
    defaultVariants: {
      size: "md",
      shape: "default",
    },
  }
);

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
    VariantProps<typeof inputVariants> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", size, shape, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(inputVariants({ size, shape }), className)}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

// A larger, hero-style search input for the landing page
const SearchInput = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, size, shape, ...props }, ref) => (
    <Input
      ref={ref}
      size={size ?? "xl"}
      shape={shape ?? "pill"}
      className={cn("", className)}
      {...props}
    />
  )
);
SearchInput.displayName = "SearchInput";

export { Input, inputVariants, SearchInput };
