"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Globe } from "lucide-react";
import { useSettings } from "@/lib/settings";

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
  const { settings } = useSettings();
  
  // Helper function to clean display URL by removing trailing slashes when appropriate
  const cleanDisplayUrl = (url: string): string => {
    // Remove trailing slash only if it's just a domain/root path
    // Keep trailing slash if there's an actual path after the domain
    if (url.endsWith('/')) {
      // Find the domain part (after protocol)
      const protocolEnd = url.indexOf('//') + 2;
      const domainAndPath = url.substring(protocolEnd);
      
      // Count slashes in the domain+path part
      const slashCount = (domainAndPath.match(/\//g) || []).length;
      
      // If there's only one slash (the trailing one), remove it
      if (slashCount === 1) {
        return url.slice(0, -1);
      }
    }
    return url;
  };
  
  const cleanedDisplayUrl = cleanDisplayUrl(result.displayUrl);
  return (
    <div className="space-y-0.8 group">
      <div className="flex items-center gap-2 mb-1">
        <a
          href={result.url}
          target="_self"
          rel="noopener noreferrer"
          className="w-5 h-5 flex-shrink-0 rounded-sm overflow-hidden bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
          title={`Visit ${cleanedDisplayUrl}`}
        >
          {settings.showFavicons && result.favicon && !faviconError ? (
            // Use a regular img tag for favicon to allow onError handling reliably
            // and avoid Next/Image optimization for external small icons
            // eslint-disable-next-line @next/next/no-img-element
            <img src={result.favicon} alt="" className="w-5 h-5 object-contain" onError={() => setFaviconError(true)} />
          ) : (
            <Globe className="w-4 h-4 text-muted-foreground" />
          )}
        </a>
        <a
          href={result.url}
          target="_self"
          rel="noopener noreferrer"
          className="text-sm text-muted-foreground hover:text-primary focus:text-primary focus:underline hover:underline transition-colors truncate"
        >
          {cleanedDisplayUrl}
        </a>
      </div>
      <a
        href={result.url}
        target="_self"
        rel="noopener noreferrer"
        className="block group/title"
      >
        <h2 className="text-xl font-semibold group/title-hover:text-primary group/title-focus:text-primary group/title-hover:underline group/title-focus:underline group-hover:underline transition-colors line-clamp-2">
          {result.title}
        </h2>
      </a>
      <a
        href={result.url}
        target="_self"
        rel="noopener noreferrer"
        className="block text-muted-foreground line-clamp-3 break-words transition-colors"
      >
        {result.description}
      </a>
    </div>
  );
}

export default WebResultItem;
