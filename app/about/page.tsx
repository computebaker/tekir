"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Lock, Search, MessageCircleMore, Github, Heart } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import Footer from "@/components/footer";
import { BadgeChip } from "@/components/shared/badge-chip";
import { SectionHeading } from "@/components/shared/section-heading";
import { buttonVariants } from "@/components/ui/button";
import { storeRedirectUrl } from "@/lib/utils";

export default function AboutPage() {
  useEffect(() => {
    document.title = "About Us | Tekir";
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-grow">
        {/* Features Section with Bento Grid */}
        <section className="py-20 px-4 bg-gradient-to-br from-gray-50/30 via-slate-50/25 to-neutral-50/30 dark:from-gray-950/10 dark:via-slate-950/8 dark:to-neutral-950/10">
          <div className="max-w-7xl mx-auto">
            <SectionHeading
              title="The Search Engine That Respects You"
              subtitle={<>
                Discover why others choose Tekir for their daily searches. <br className="hidden sm:block" />
                Privacy-focused, lightning-fast, and packed with intelligent features.
              </>}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Privacy First - Large Card */}
              <Link href="/privacy" className="lg:col-span-2 block group">
                <div className="bg-gradient-to-br from-gray-500/10 to-slate-600/10 p-8 rounded-2xl border border-gray-500/30 relative overflow-hidden hover:border-gray-500/50 transition-all duration-300 group-hover:shadow-xl group-hover:shadow-gray-500/20">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-gray-400/20 via-slate-400/15 to-transparent rounded-full blur-3xl"></div>
                  <div className="relative z-10">
                    <div className="w-16 h-16 bg-gray-500/20 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-gray-500/30 transition-colors">
                      <Lock className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-2xl font-bold text-foreground mb-4 group-hover:text-muted-foreground transition-colors">Privacy by Design</h3>
                    <p className="text-muted-foreground text-lg leading-relaxed">
                      No tracking, no data collection, no profile building. Your searches remain completely private
                      and are never stored or shared with third parties.
                    </p>
                  </div>
                </div>
              </Link>

              {/* Lightning Fast */}
              <div className="bg-gradient-to-br from-slate-500/10 to-gray-600/10 p-8 rounded-2xl border border-slate-500/30 relative overflow-hidden hover:shadow-xl hover:shadow-slate-500/20 transition-all duration-300">
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-slate-400/20 via-gray-400/15 to-transparent rounded-full blur-2xl"></div>
                <div className="relative z-10">
                  <div className="w-12 h-12 bg-slate-500/20 rounded-xl flex items-center justify-center mb-4">
                    <div className="w-6 h-6 bg-muted-foreground rounded-full animate-pulse"></div>
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-3">Lightning Fast</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Get results in milliseconds with our optimized search infrastructure. Never stay waiting for answers.
                  </p>
                </div>
              </div>

              {/* AI-Powered Chat */}
              <Link href="https://chat.tekir.co" className="block group" target="_blank" rel="noopener noreferrer">
                <div className="bg-gradient-to-br from-gray-500/10 to-slate-600/10 p-8 rounded-2xl border border-gray-500/30 relative overflow-hidden hover:border-gray-500/50 transition-all duration-300 group-hover:shadow-xl group-hover:shadow-gray-500/20">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-gray-400/20 via-slate-400/15 to-transparent rounded-full blur-2xl"></div>
                  <div className="relative z-10">
                    <div className="w-12 h-12 bg-gray-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:bg-gray-500/30 transition-colors">
                      <MessageCircleMore className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <h3 className="text-xl font-bold text-foreground mb-3 group-hover:text-muted-foreground transition-colors">AI-Powered Chat</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      Get instant answers with our integrated AI chat powered by advanced language models.
                    </p>
                    <br />
                    <p className="text-muted-foreground leading-relaxed">
                      Experience seamless conversations and get the information you need, when you need it. Use our AI chat to dive deeper into topics and ask follow-up questions.
                    </p>
                  </div>
                </div>
              </Link>

              {/* Bang Commands - Large Card */}
              <Link href="/bangs" className="lg:col-span-2 block group">
                <div className="bg-gradient-to-br from-slate-500/10 to-gray-600/10 p-8 rounded-2xl border border-slate-500/30 relative overflow-hidden hover:border-slate-500/50 transition-all duration-300 group-hover:shadow-xl group-hover:shadow-slate-500/20">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-slate-400/20 to-transparent rounded-full blur-3xl"></div>
                  <div className="relative z-10">
                    <div className="w-16 h-16 bg-slate-500/20 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-slate-500/30 transition-colors">
                      <div className="text-2xl font-bold text-muted-foreground">!</div>
                    </div>
                    <h3 className="text-2xl font-bold text-foreground mb-4 group-hover:text-muted-foreground transition-colors">Bang Commands</h3>
                    <p className="text-muted-foreground text-lg leading-relaxed mb-4">
                      Search directly on your favorite sites with bang commands. Type <code className="bg-muted px-2 py-1 rounded">!g</code> for Google,
                      <code className="bg-muted px-2 py-1 rounded ml-2">!w</code> for Wikipedia, and hundreds more.
                    </p>
                    <div className="flex flex-wrap gap-2 mb-4">
                      <BadgeChip color="slate">!g Google</BadgeChip>
                      <BadgeChip color="slate">!w Wikipedia</BadgeChip>
                      <BadgeChip color="slate">!gh GitHub</BadgeChip>
                      <BadgeChip color="slate">!yt YouTube</BadgeChip>
                    </div>
                    <div className="inline-flex items-center text-muted-foreground group-hover:text-foreground font-medium transition-colors">
                      More bangs →
                    </div>
                  </div>
                </div>
              </Link>

              {/* Smart Autocomplete */}
              <Link href="/settings/search" className="block group" onClick={() => storeRedirectUrl(window.location.href)}>
                <div className="bg-gradient-to-br from-gray-500/10 to-slate-600/10 p-8 rounded-2xl border border-gray-500/30 relative overflow-hidden hover:border-gray-500/50 transition-all duration-300 group-hover:shadow-xl group-hover:shadow-gray-500/20">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-gray-400/20 to-transparent rounded-full blur-2xl"></div>
                  <div className="relative z-10">
                    <div className="w-12 h-12 bg-gray-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:bg-gray-500/30 transition-colors">
                      <Search className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <h3 className="text-xl font-bold text-foreground mb-3 group-hover:text-muted-foreground transition-colors">Smart Autocomplete</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      Intelligent suggestions that learn from global search patterns while keeping your data private.
                    </p>
                  </div>
                </div>
              </Link>

              {/* Weather Widget */}
              <Link href="https://clim8.tekir.co" className="block group" target="_blank" rel="noopener noreferrer">
                <div className="bg-gradient-to-br from-slate-500/10 to-gray-600/10 p-8 rounded-2xl border border-slate-500/30 relative overflow-hidden hover:border-slate-500/50 transition-all duration-300 group-hover:shadow-xl group-hover:shadow-slate-500/20">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-slate-400/20 to-transparent rounded-full blur-2xl"></div>
                  <div className="relative z-10">
                    <div className="w-12 h-12 bg-slate-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:bg-slate-500/30 transition-colors">
                      <div className="w-6 h-6 bg-muted-foreground rounded-full relative">
                        <div className="absolute inset-1 bg-yellow-400 rounded-full"></div>
                      </div>
                    </div>
                    <h3 className="text-xl font-bold text-foreground mb-3 group-hover:text-muted-foreground transition-colors">Weather at a Glance</h3>
                    <p className="text-muted-foreground leading-relaxed mb-4">
                      Get current weather conditions right on your search homepage.
                    </p>
                  </div>
                </div>
              </Link>

              {/* Open Source */}
              <Link href="https://github.com/computebaker/tekir" className="block group" target="_blank" rel="noopener noreferrer">
                <div className="bg-gradient-to-br from-gray-500/10 to-slate-600/10 p-8 rounded-2xl border border-gray-500/30 relative overflow-hidden hover:border-gray-500/50 transition-all duration-300 group-hover:shadow-xl group-hover:shadow-gray-500/20">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-gray-400/20 to-transparent rounded-full blur-2xl"></div>
                  <div className="relative z-10">
                    <div className="w-12 h-12 bg-gray-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:bg-gray-500/30 transition-colors">
                      <Github className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <h3 className="text-xl font-bold text-foreground mb-3 group-hover:text-muted-foreground transition-colors">Open Source</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      Transparent, auditable code that you can inspect and contribute to.
                    </p>
                  </div>
                </div>
              </Link>

              {/* Multiple Providers */}
              <Link href="/settings/search" className="lg:col-span-2 block group" onClick={() => storeRedirectUrl(window.location.href)}>
                <div className="bg-gradient-to-br from-gray-500/10 to-slate-600/10 p-8 rounded-2xl border border-gray-500/30 relative overflow-hidden hover:border-gray-500/50 transition-all duration-300 group-hover:shadow-xl group-hover:shadow-gray-500/20">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-gray-400/20 to-transparent rounded-full blur-3xl"></div>
                  <div className="relative z-10">
                    <div className="w-16 h-16 bg-gray-500/20 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-gray-500/30 transition-colors">
                      <div className="grid grid-cols-2 gap-1">
                        <div className="w-3 h-3 bg-muted-foreground rounded-full"></div>
                        <div className="w-3 h-3 bg-muted-foreground rounded-full"></div>
                        <div className="w-3 h-3 bg-muted-foreground rounded-full"></div>
                        <div className="w-3 h-3 bg-muted-foreground rounded-full"></div>
                      </div>
                    </div>
                    <h3 className="text-2xl font-bold text-foreground mb-4 group-hover:text-muted-foreground transition-colors">Multiple Search Providers</h3>
                    <p className="text-muted-foreground text-lg leading-relaxed mb-4">
                      Choose from multiple search engines and sources to get the most comprehensive results.
                      Switch between providers to find exactly what you&apos;re looking for.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <BadgeChip color="gray">Google</BadgeChip>
                      <BadgeChip color="gray">Bing</BadgeChip>
                      <BadgeChip color="gray">DuckDuckGo</BadgeChip>
                      <BadgeChip color="gray">Brave</BadgeChip>
                    </div>
                  </div>
                </div>
              </Link>

              {/* Made for Everyone */}
              <div className="bg-gradient-to-br from-slate-500/10 to-gray-600/10 p-8 rounded-2xl border border-slate-500/30 relative overflow-hidden hover:border-slate-500/50 transition-all duration-300 group-hover:shadow-xl group-hover:shadow-slate-500/20">
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-slate-400/20 to-transparent rounded-full blur-2xl"></div>
                <div className="relative z-10">
                  <div className="w-12 h-12 bg-slate-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:bg-slate-500/30 transition-colors">
                    <Heart className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-3 group-hover:text-muted-foreground transition-colors">Made for Everyone</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Accessible, inclusive, and designed to work for all users regardless of their background or abilities. Does not discriminate based on location, language, or device. Made for all, by all.
                  </p>
                </div>
              </div>
            </div>

            {/* CTA Section */}
            <div className="text-center mt-16">
              <h3 className="text-2xl font-bold text-foreground mb-4">
                Ready to experience better search?
              </h3>
              <p className="text-muted-foreground mb-8">
                Start searching with Tekir today and discover the difference privacy makes.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/" className={buttonVariants({ variant: "default", size: "lg" }) + " rounded-full px-8"}>
                  Try Tekir Now
                </Link>
                <Link href="/settings/search" className={buttonVariants({ variant: "secondary", size: "lg" }) + " rounded-full px-8"} onClick={() => storeRedirectUrl(window.location.href)}>
                  Settings
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer variant="minimal" />
    </div>
  );
}
