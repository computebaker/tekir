import type { LucideIcon } from "lucide-react";
import React from "react";

export type FeatureCardProps = {
  icon?: LucideIcon;
  iconNode?: React.ReactNode; // for custom SVGs
  title: string;
  description: string;
  iconClassName?: string;
  wrapperClassName?: string;
};

export function FeatureCard({ icon: Icon, iconNode, title, description, iconClassName = "", wrapperClassName = "" }: FeatureCardProps) {
  return (
    <div className={`bg-card rounded-lg p-6 border border-border shadow-sm ${wrapperClassName}`}>
      <div className="bg-muted w-14 h-14 rounded-full flex items-center justify-center mb-4">
        {Icon ? <Icon className={`w-7 h-7 ${iconClassName}`} /> : iconNode}
      </div>
      <h3 className="text-xl font-medium mb-2">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
}

export default FeatureCard;
