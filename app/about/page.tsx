"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Cat, Search, ExternalLink, ArrowRight, Instagram, Github } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import Footer from "@/components/footer";

export default function AboutPage() {
  const [demoQuery, setDemoQuery] = useState("What is Tekir?");
  const [demoWikiQuery, setDemoWikiQuery] = useState("Turkish Van Cat");
  const [followUpQuestion, setFollowUpQuestion] = useState("");

  // Demo Wikipedia data
  const wikiData = {
    title: "Turkish Van Cat",
    extract: "The Turkish Van is a rare and ancient cat breed that developed in the Lake Van region of Turkey. They are distinguished by their unusual pattern of colored markings, which appear primarily on the head and tail with the rest of the cat being white. The breed is notable for its unusual love of water and swimming, leading to the nickname 'swimming cats'.",
    thumbnail: {
      source: "/turkish-van.png",
    },
    pageUrl: "https://en.wikipedia.org/wiki/Turkish_Van"
  };

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-grow p-4 pt-8 md:p-8 md:pt-16">
        {/* Hero Section */}
        <div className="max-w-6xl mx-auto mb-16 text-center pt-8 md:pt-12">
          <div className="flex justify-center mb-6">
            <Image src="/tekir.png" alt="Tekir Logo" width={96} height={96} priority />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Meet Tekir</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            The open-source, AI-powered search engine that respects your privacy and delivers better results.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/" 
              className="px-6 py-3 rounded-full bg-primary text-primary-foreground hover:opacity-90 transition-opacity font-medium flex items-center gap-2">
              <Search className="w-5 h-5" />
              Try Tekir Now
            </Link>
            <a href="https://github.com/computebaker/tekir" 
              className="px-6 py-3 rounded-full bg-secondary text-secondary-foreground hover:opacity-90 transition-opacity font-medium flex items-center gap-2"
              target="_blank" rel="noopener noreferrer">
              <Github className="w-5 h-5" />
              View on GitHub
            </a>
          </div>
        </div>

        {/* Features Section */}
        <section className="max-w-6xl mx-auto mb-16">
          <h2 className="text-3xl font-semibold mb-8 text-center">Why Choose Tekir?</h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-card rounded-lg p-6 border border-border shadow-sm">
              <div className="bg-primary/10 w-14 h-14 rounded-full flex items-center justify-center mb-4">
                <Search className="w-7 h-7 text-primary" />
              </div>
              <h3 className="text-xl font-medium mb-2">Private Search</h3>
              <p className="text-muted-foreground">
                Tekir doesn't track your searches or build user profiles to sell to advertisers.
              </p>
            </div>
            
            <div className="bg-card rounded-lg p-6 border border-border shadow-sm">
              <div className="bg-blue-500/10 w-14 h-14 rounded-full flex items-center justify-center mb-4">
                <Cat className="w-7 h-7 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-xl font-medium mb-2">AI-Powered</h3>
              <p className="text-muted-foreground">
                Instant answers to your questions with our AI assistant, Karakulak.
              </p>
            </div>
            
            <div className="bg-card rounded-lg p-6 border border-border shadow-sm">
              <div className="bg-green-500/10 w-14 h-14 rounded-full flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600 dark:text-green-400">
                  <path d="m8 3 4 8 5-5 5 15H2L8 3z"></path>
                </svg>
              </div>
              <h3 className="text-xl font-medium mb-2">Open Source</h3>
              <p className="text-muted-foreground">
                Fully transparent code that anyone can inspect, modify, and contribute to.
              </p>
            </div>
          </div>
        </section>

        {/* AI Assistant Demo */}
        <section className="max-w-6xl mx-auto mb-16">
          <h2 className="text-3xl font-semibold mb-2 text-center">AI-Assisted Search</h2>
          <p className="text-center text-muted-foreground mb-8 max-w-2xl mx-auto">
            Tekir's Karakulak AI provides instant, helpful answers to your questions directly on the search page.
          </p>

          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="mb-8 p-6 rounded-lg bg-blue-50 dark:bg-blue-900/20 max-w-3xl mx-auto"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <Cat className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <span className="ml-2 font-medium text-blue-800 dark:text-blue-200 inline-flex items-center">
                  Karakulak AI
                  <span className="ml-2 inline-flex items-center px-2 py-0.5 text-xs font-semibold bg-blue-600 text-white rounded-full">
                    BETA
                  </span>
                  <Link href="https://chat.tekir.co" className="ml-2 text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center">
                    Try Tekir Chat →
                  </Link>
                </span>
              </div>
              
              <div className="relative">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-200">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{backgroundColor: '#0f0f0f'}}>
                    <Image src="/google.png" alt="Google Logo" width={16} height={16} className="rounded" />
                  </div>
                  <span>Gemini 2.0 Flash</span>
                </div>
              </div>
            </div>
            
            <p className="text-left text-blue-800 dark:text-blue-100 mb-3">
              Tekir is an open-source search engine that combines traditional web search with AI-powered answers. 
              Unlike other search engines, Tekir doesn't track users or collect personal data. 
              It features Karakulak AI, which can answer questions directly, and also shows relevant Wikipedia information alongside search results. 
              Tekir is developed in Turkey and is completely free to use.
            </p>
            
            <p className="text-sm text-blue-600/70 dark:text-blue-300/70 mb-4">
              Auto-generated based on online sources. May contain inaccuracies.
            </p>
            
            <form className="mt-4 border-t border-blue-200 dark:border-blue-800 pt-4">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={followUpQuestion}
                  onChange={(e) => setFollowUpQuestion(e.target.value)}
                  placeholder="Ask a follow-up question..."
                  className="flex-1 px-3 py-2 rounded-md border border-blue-200 dark:border-blue-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  className="p-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center"
                  aria-label="Ask follow-up question"
                >
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </form>
          </motion.div>
        </section>

        {/* Wikipedia Demo */}
        <section className="max-w-6xl mx-auto mb-16">
          <h2 className="text-3xl font-semibold mb-2 text-center">Wikipedia Integration</h2>
          <p className="text-center text-muted-foreground mb-8 max-w-2xl mx-auto">
            Quickly access relevant Wikipedia content alongside your search results.
          </p>

          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="p-6 rounded-lg bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 shadow-md max-w-md mx-auto"
          >
            <h3 className="text-xl font-semibold mb-4">{wikiData.title}</h3>
            
            <div className="mb-4 w-full">
              <div className="relative w-full aspect-[4/3] overflow-hidden rounded-lg">
                <Image 
                  src="/turkish-van.png" 
                  alt="Turkish Van Cat"
                  className="object-cover"
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
              </div>
            </div>
            
            <div className="mb-4">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {wikiData.extract}
              </p>
            </div>
            
            <div className="text-sm text-gray-500 dark:text-gray-400">
              <span>Source: </span>
              <a 
                href={wikiData.pageUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
              >
                Wikipedia
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </motion.div>
        </section>

        {/* Chat Feature */}
        <section className="max-w-6xl mx-auto mb-16">
          <h2 className="text-3xl font-semibold mb-2 text-center">Tekir Chat</h2>
          <p className="text-center text-muted-foreground mb-8 max-w-2xl mx-auto">
            Have longer conversations with multiple AI models to get more detailed answers.
          </p>

          <div className="bg-card rounded-lg border border-border p-6 md:p-8 max-w-3xl mx-auto shadow-sm">
            <div className="bg-muted p-4 rounded-lg mb-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <Search className="w-4 h-4 text-primary" />
                </div>
                <span className="font-medium">Ask stuff, without your data being stolen.</span>
              </div>
              <Image 
                src="/chat-demo.png" 
                alt="Tekir Chat Demo" 
                width={800} 
                height={400} 
                className="rounded-lg border border-border shadow-sm"
              />
            </div>
            
            <div className="text-center">
              <Link 
                href="https://chat.tekir.co"
                className="inline-flex items-center px-5 py-2.5 rounded-full bg-primary text-primary-foreground hover:opacity-90 transition-opacity font-medium"
              >
                Try Tekir Chat <ArrowRight className="ml-2 w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* Models Section */}
        <section className="max-w-6xl mx-auto mb-16">
          <h2 className="text-3xl font-semibold mb-2 text-center">Models that you love</h2>
          <p className="text-center text-muted-foreground mb-8 max-w-2xl mx-auto">
            Tekir leverages multiple state-of-the-art AI models to provide the best possible answers for all your needs.
          </p>

          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center"
            >
              <div className="relative w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center p-3" style={{backgroundColor: '#0f0f0f'}}>
                <Image 
                  src="/google.png" 
                  alt="Google Gemini" 
                  fill
                  className="object-contain p-1"
                />
              </div>
              <p className="mt-2 text-sm font-medium">Gemini</p>
            </motion.div>

            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="flex flex-col items-center"
            >
              <div className="relative w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center p-3" style={{backgroundColor: '#0f0f0f'}}>
                <Image 
                  src="/meta.png" 
                  alt="Meta Llama" 
                  fill
                  className="object-contain p-1"
                />
              </div>
              <p className="mt-2 text-sm font-medium">Llama</p>
            </motion.div>

            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="flex flex-col items-center"
            >
              <div className="relative w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center p-3" style={{backgroundColor: '#0f0f0f'}}>
                <Image 
                  src="/mistral.png" 
                  alt="Mistral AI" 
                  fill
                  className="object-contain p-1"
                />
              </div>
              <p className="mt-2 text-sm font-medium">Mistral</p>
            </motion.div>

            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="flex flex-col items-center"
            >
              <div className="relative w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center p-3" style={{backgroundColor: '#0f0f0f'}}>
                <Image 
                  src="/openai.png" 
                  alt="OpenAI" 
                  fill
                  className="object-contain p-1"
                />
              </div>
              <p className="mt-2 text-sm font-medium">ChatGPT</p>
            </motion.div>
          </div>
        </section>

        {/* Open Source Section */}
        <section className="max-w-6xl mx-auto mb-16 text-center">
          <h2 className="text-3xl font-semibold mb-4">Join the team</h2>
          <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
            Tekir is built to be open. Join our community to help build a better search experience for everyone.
          </p>
          <a 
            href="https://github.com/computebaker/tekir" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center px-6 py-3 rounded-full bg-secondary text-secondary-foreground hover:opacity-90 transition-opacity font-medium"
          >
            <Github className="mr-2 w-5 h-5" />
            Contribute on GitHub
          </a>
        </section>
      </main>

      <Footer variant="minimal" />
    </div>
  );
}
