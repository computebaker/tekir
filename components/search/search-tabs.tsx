"use client";

import React from "react";
import { Search, Image as ImageIcon, Newspaper } from "lucide-react";

type Props = {
  active: "web" | "images" | "news";
  onChange: (type: "web" | "images" | "news") => void;
};

export function SearchTabs({ active, onChange }: Props) {
  return (
    <div className="flex space-x-4" role="tablist" aria-label="Search result types">
      <button
        onClick={() => onChange("web")}
        className="pb-2 px-1 flex items-center gap-2 transition-colors relative group"
        role="tab"
        aria-selected={active === "web"}
        tabIndex={active === "web" ? 0 : -1}
      >
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4" />
          <span className={active === "web" ? "text-primary font-medium" : "text-muted-foreground group-hover:text-foreground"}>
            Search
          </span>
        </div>
        {active === "web" && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" style={{ width: "100%", maxWidth: "62px", margin: "0 auto" }} />
        )}
      </button>

      <button
        onClick={() => onChange("images")}
        className="pb-2 px-1 flex items-center gap-2 transition-colors relative group"
        role="tab"
        aria-selected={active === "images"}
        tabIndex={active === "images" ? 0 : -1}
      >
        <div className="flex items-center gap-2">
          <ImageIcon className="w-4 h-4" />
          <span className={active === "images" ? "text-primary font-medium" : "text-muted-foreground group-hover:text-foreground"}>
            Images
          </span>
        </div>
        {active === "images" && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" style={{ width: "100%", maxWidth: "64px", margin: "0 auto" }} />
        )}
      </button>

      <button
        onClick={() => onChange("news")}
        className="pb-2 px-1 flex items-center gap-2 transition-colors relative group"
        role="tab"
        aria-selected={active === "news"}
        tabIndex={active === "news" ? 0 : -1}
      >
        <div className="flex items-center gap-2">
          <Newspaper className="w-4 h-4" />
          <span className={active === "news" ? "text-primary font-medium" : "text-muted-foreground group-hover:text-foreground"}>
            News
          </span>
        </div>
        {active === "news" && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" style={{ width: "100%", maxWidth: "48px", margin: "0 auto" }} />
        )}
      </button>
    </div>
  );
}

export default SearchTabs;
