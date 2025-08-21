"use client";

import React from "react";

export type WebResult = {
  title: string;
  description: string;
  displayUrl: string;
  url: string;
};

type Props = {
  result: WebResult;
};

export function WebResultItem({ result }: Props) {
  return (
    <div className="space-y-2">
      <a
        href={result.url}
        target="_self"
        rel="noopener noreferrer"
        className="block group"
      >
        <p className="text-sm text-muted-foreground mb-1 truncate">{result.displayUrl}</p>
        <h2 className="text-xl font-semibold group-hover:text-primary transition-colors line-clamp-2">
          {result.title}
        </h2>
        <p className="text-muted-foreground line-clamp-3 break-words">{result.description}</p>
      </a>
    </div>
  );
}

export default WebResultItem;
