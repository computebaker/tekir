"use client";
import Link from "next/link";
import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

type MainFooterProps = {
  hidden?: boolean;
  className?: string;
};

export default function MainFooter({ hidden, className }: MainFooterProps) {
  const tFooter = useTranslations("footer");

  return (
    <footer
      className={cn(
  "fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80",
  "pb-[env(safe-area-inset-bottom)]",
        "text-sm text-muted-foreground",
        "transition-all duration-200 ease-out",
        hidden ? "pointer-events-none opacity-0 translate-y-2" : "opacity-100 translate-y-0",
        className,
      )}
      aria-hidden={hidden}
    >
      {/* Links row */}
  <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <nav className="flex flex-wrap items-center justify-center sm:justify-start gap-x-6 gap-y-2">
            <Link href="/about" className="hover:text-foreground transition-colors">{tFooter("about")}</Link>
            <Link href="/links" className="hover:text-foreground transition-colors">{tFooter("links")}</Link>
            <span className="hidden lg:inline-flex absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 items-center text-emerald-600 dark:text-emerald-400">
                <Lock className="mr-2 h-4 w-4" />
                {tFooter("privacyPromise")}
            </span>
          </nav>
          <nav className="flex flex-wrap items-center justify-center sm:justify-end gap-x-6 gap-y-2">
            <Link href="/privacy" className="hover:text-foreground transition-colors">{tFooter("privacy")}</Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">{tFooter("terms")}</Link>
            <Link href="/settings" className="hover:text-foreground transition-colors">{tFooter("settings")}</Link>
          </nav>
        </div>
    {/* Mobile privacy note (centered) */}
  <div className="mt-3 w-full flex items-center justify-center text-emerald-600 dark:text-emerald-400 lg:hidden">
          <Lock className="mr-2 h-4 w-4" />
          <span>{tFooter("privacyPromise")}</span>
        </div>
      </div>
    </footer>
  );
}
