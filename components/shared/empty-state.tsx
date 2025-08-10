"use client";

import React from "react";

type EmptyStateProps = {
  icon?: React.ReactNode;
  title?: string;
  description?: string | React.ReactNode;
  className?: string;
};

export function EmptyState({ icon, title, description, className = "" }: EmptyStateProps) {
  return (
    <div className={`text-center py-12 ${className}`}>
      <div className="text-muted-foreground">
        {icon}
        {title ? <p className="mt-2 font-medium">{title}</p> : null}
        {description ? <p className="text-sm mt-2">{description}</p> : null}
      </div>
    </div>
  );
}

export default EmptyState;
