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
        <p className="text-sm text-muted-foreground mb-1">{result.displayUrl}</p>
        <h2 className="text-xl font-semibold group-hover:text-primary transition-colors">
          {result.title}
        </h2>
        <p className="text-muted-foreground">{result.description}</p>
      </a>
    </div>
  );
}

export default WebResultItem;
