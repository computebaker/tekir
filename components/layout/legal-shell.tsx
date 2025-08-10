"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

export type LegalShellProps = {
  title: string;
  children: ReactNode;
};

export function LegalShell({ title, children }: LegalShellProps) {
  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      <div className="max-w-4xl mx-auto">
        <Link href="/" className="inline-block mb-6">
          <Image
            src="/tekir.png"
            alt="Tekir Logo"
            width={120}
            height={40}
            className="h-auto"
            priority
          />
        </Link>

        <h1 className="text-3xl md:text-4xl font-bold mb-6">{title}</h1>

        <div className="space-y-8">{children}</div>
      </div>
    </div>
  );
}

export default LegalShell;
