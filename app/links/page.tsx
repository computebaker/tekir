"use client";

import Image from "next/image";
import Link from "next/link";
import { ExternalLink, Search, MessageCircleMore, Zap, Twitter, Instagram } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import Footer from "@/components/footer";
import { buttonVariants } from "@/components/ui/button";

export default function LinksPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <main className="flex-grow p-4 pt-8 md:p-8 md:pt-16">
        <div className="max-w-md mx-auto">
          {/* Header with Logo and Theme Toggle */}
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-3">
              <Image src="/tekir.png" alt="Tekir Logo" width={48} height={48} priority />
              <h1 className="text-2xl font-bold">Tekir</h1>
            </div>
            <ThemeToggle />
          </div>

          {/* Profile Section */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center bg-transparent">
              <Image src="/tekir-head.png" alt="Tekir Profile" width={64} height={64} className="w-full h-full object-contain" />
            </div>
            <p className="text-muted-foreground">
              Fast, open-source & privacy-focused search engine
            </p>
          </div>

          {/* TRY OUR APP NOW Section */}
          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-4 text-center text-primary">TRY OUR APP NOW</h2>
            <Link href="/" className={buttonVariants({ variant: "default", size: "lg" }) + " w-full justify-between hover:scale-[1.02] transition-transform shadow-lg"}>
              <div className="flex items-center gap-3">
                <Search className="w-6 h-6" />
                <div>
                  <div className="font-semibold">Try Tekir</div>
                  <div className="text-sm opacity-80">Start searching now</div>
                </div>
              </div>
              <ExternalLink className="w-5 h-5 opacity-60 group-hover:opacity-100 transition-opacity" />
            </Link>
          </section>

          {/* Socials Section */}
          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-4 text-center text-muted-foreground">Socials</h2>
            <div className="space-y-3">
              <a 
                href="https://bsky.app/profile/tekir.co"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full p-4 rounded-lg bg-card border border-border hover:bg-accent transition-all duration-200 hover:scale-[1.02] flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded bg-muted flex items-center justify-center">
                    <span className="text-foreground text-xs font-bold">B</span>
                  </div>
                  <div>
                    <div className="font-medium">Bluesky</div>
                    <div className="text-sm text-muted-foreground">@tekir.co</div>
                  </div>
                </div>
                <ExternalLink className="w-5 h-5 opacity-60 group-hover:opacity-100 transition-opacity" />
              </a>

              <a 
                href="https://instagram.com/tekirsearch"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full p-4 rounded-lg bg-card border border-border hover:bg-accent transition-all duration-200 hover:scale-[1.02] flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <Instagram className="w-6 h-6 text-muted-foreground" />
                  <div>
                    <div className="font-medium">Instagram</div>
                    <div className="text-sm text-muted-foreground">@tekirsearch</div>
                  </div>
                </div>
                <ExternalLink className="w-5 h-5 opacity-60 group-hover:opacity-100 transition-opacity" />
              </a>

              <a 
                href="https://x.com/tekirsearch"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full p-4 rounded-lg bg-card border border-border hover:bg-accent transition-all duration-200 hover:scale-[1.02] flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <Twitter className="w-6 h-6" />
                  <div>
                    <div className="font-medium">X (Twitter)</div>
                    <div className="text-sm text-muted-foreground">@tekirsearch</div>
                  </div>
                </div>
                <ExternalLink className="w-5 h-5 opacity-60 group-hover:opacity-100 transition-opacity" />
              </a>
            </div>
          </section>

          {/* More From Us Section */}
          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-4 text-center text-muted-foreground">More From Us</h2>
            <div className="space-y-3">
              <Link 
                href="/about"
                className="w-full p-4 rounded-lg bg-card border border-border hover:bg-accent transition-all duration-200 hover:scale-[1.02] flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded bg-secondary flex items-center justify-center">
                    <span className="text-secondary-foreground text-xs font-bold">?</span>
                  </div>
                  <div>
                    <div className="font-medium">About</div>
                    <div className="text-sm text-muted-foreground">Learn more about Tekir</div>
                  </div>
                </div>
                <ExternalLink className="w-5 h-5 opacity-60 group-hover:opacity-100 transition-opacity" />
              </Link>

              <a 
                href="https://chat.tekir.co"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full p-4 rounded-lg bg-card border border-border hover:bg-accent transition-all duration-200 hover:scale-[1.02] flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <MessageCircleMore className="w-6 h-6 text-muted-foreground" />
                  <div>
                    <div className="font-medium">Chat</div>
                    <div className="text-sm text-muted-foreground">chat.tekir.co</div>
                  </div>
                </div>
                <ExternalLink className="w-5 h-5 opacity-60 group-hover:opacity-100 transition-opacity" />
              </a>

              <Link 
                href="/bangs"
                className="w-full p-4 rounded-lg bg-card border border-border hover:bg-accent transition-all duration-200 hover:scale-[1.02] flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <Zap className="w-6 h-6 text-muted-foreground" />
                  <div>
                    <div className="font-medium">Bangs</div>
                    <div className="text-sm text-muted-foreground">Quick search shortcuts</div>
                  </div>
                </div>
                <ExternalLink className="w-5 h-5 opacity-60 group-hover:opacity-100 transition-opacity" />
              </Link>
            </div>
          </section>
        </div>
      </main>

      <Footer variant="minimal" />
    </div>
  );
}