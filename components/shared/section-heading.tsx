"use client";

import React from "react";

type SectionHeadingProps = {
  title: string;
  subtitle?: string | React.ReactNode;
  align?: "left" | "center";
  className?: string;
};

export function SectionHeading({ title, subtitle, align = "center", className = "" }: SectionHeadingProps) {
  return (
    <div className={`text-${align} mb-16 ${className}`}>
      <h2 className="text-4xl font-bold text-foreground mb-4">{title}</h2>
      {subtitle ? (
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">{subtitle}</p>
      ) : null}
    </div>
  );
}

export default SectionHeading;
