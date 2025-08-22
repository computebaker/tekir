"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Globe } from "lucide-react";

export type WebResult = {
  title: string;
  description: string;
  displayUrl: string;
  url: string;
  favicon?: string;
};

type Props = {
  result: WebResult;
};

export function WebResultItem({ result }: Props) {
  const [faviconError, setFaviconError] = useState(false);
  return (
    <div className="space-y-2">
      <a
        href={result.url}
        target="_self"
        rel="noopener noreferrer"
        className="block group"
      >
        <div className="flex items-center gap-2 mb-1">
          <div className="w-5 h-5 flex-shrink-0 rounded-sm overflow-hidden bg-muted flex items-center justify-center">
            {result.favicon && !faviconError ? (
              // Use a regular img tag for favicon to allow onError handling reliably
              // and avoid Next/Image optimization for external small icons
              // eslint-disable-next-line @next/next/no-img-element
              <img src={result.favicon} alt="" className="w-5 h-5 object-contain" onError={() => setFaviconError(true)} />
            ) : (
              <Globe className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
          <p className="text-sm text-muted-foreground truncate">{result.displayUrl}</p>
        </div>
        <h2 className="text-xl font-semibold group-hover:text-primary transition-colors line-clamp-2">
          {result.title}
        </h2>
        <p className="text-muted-foreground line-clamp-3 break-words">{result.description}</p>
      </a>
    </div>
  );
}

export default WebResultItem;
