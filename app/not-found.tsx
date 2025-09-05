"use client";

import Link from "next/link";
import Image from "next/image";
import { Search, Home, ArrowLeft, Cat } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import Footer from "@/components/footer";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="w-full p-4 md:p-6">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <Link href="/" className="flex items-center gap-3">
            <Image 
              src="/tekir-outlined.png" 
              alt="Tekir Logo" 
              width={40} 
              height={40} 
              priority 
            />
            <span className="text-xl font-semibold">Tekir</span>
          </Link>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow flex items-center justify-center px-4 py-16">
        <div className="max-w-2xl mx-auto text-center space-y-8">
          <div className="relative">
            <div className="text-8xl md:text-9xl font-bold text-muted-foreground/20 select-none neon-blink">
              404
            </div>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
            </div>
          </div>
          <style jsx>{`
            @keyframes neonBlink {
              0%, 100% {
                opacity: 1;
                text-shadow: 0 0 8px #fff, 0 0 16px #f0f, 0 0 32px #0ff;
              }
              15% {
                opacity: 0.85;
                text-shadow: 0 0 4px #fff, 0 0 8px #f0f, 0 0 16px #0ff;
              }
              25% {
                opacity: 0.6;
                text-shadow: none;
              }
              30% {
                opacity: 1;
                text-shadow: 0 0 8px #fff, 0 0 16px #f0f, 0 0 32px #0ff;
              }
              70% {
                opacity: 1;
                text-shadow: 0 0 12px #fff, 0 0 24px #f0f, 0 0 48px #0ff;
              }
              80% {
                opacity: 0.8;
                text-shadow: 0 0 4px #fff, 0 0 8px #f0f, 0 0 16px #0ff;
              }
              90% {
                opacity: 1;
                text-shadow: 0 0 12px #fff, 0 0 24px #f0f, 0 0 48px #0ff;
              }
            }
            .neon-blink {
              animation: neonBlink 2.5s infinite;
              color: #fff;
              text-shadow:
                0 0 4px #fff,
                0 0 8px #f0f,
                0 0 16px #0ff;
            }
          `}</style>

          {/* Content */}
          <div className="space-y-4">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground">
              Page not found
            </h1>
            <p className="text-lg text-muted-foreground max-w-md mx-auto">
              Looks like Karakulak couldn&apos;t find what you&apos;re looking for. 
              The page you&apos;re searching for doesn&apos;t exist or has been moved.
            </p>
          </div>

          {/* Search Bar */}
          <div className="w-full max-w-lg mx-auto">
            <form action="/search" method="GET" className="relative" autoComplete="off">
              <input
                type="text"
                name="q"
                placeholder="Try searching for something else..."
                autoComplete="off"
                className="w-full px-6 py-4 pr-14 rounded-full border border-border bg-background shadow-lg focus:outline-none focus:ring-2 focus:ring-primary/20 text-lg"
              />
              <button
                type="submit"
                className="absolute right-3 top-1/2 -translate-y-1/2 p-3 rounded-full text-muted-foreground hover:bg-muted transition-colors"
                title="Search"
              >
                <Search className="w-5 h-5" />
              </button>
            </form>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-primary-foreground hover:opacity-90 transition-opacity font-medium"
            >
              <Home className="w-5 h-5" />
              Go to Homepage
            </Link>
            <button
              onClick={() => window.history.back()}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-secondary text-secondary-foreground hover:opacity-90 transition-opacity font-medium"
            >
              <ArrowLeft className="w-5 h-5" />
              Go Back
            </button>
          </div>

          {/* Quick Links */}
          <div className="pt-8 border-t border-border">
            <p className="text-sm text-muted-foreground mb-4">Quick links:</p>
            <div className="flex flex-wrap justify-center gap-4 text-sm">
              <Link
                href="/about"
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                About Tekir
              </Link>
              <Link
                href="https://chat.tekir.co"
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                AI Chat
              </Link>
              <Link
                href="/privacy"
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                Privacy Policy
              </Link>
              <Link
                href="https://github.com/computebaker/tekir"
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                GitHub
              </Link>
            </div>
          </div>
        </div>
      </main>

      <Footer variant="minimal" />
    </div>
  );
}
