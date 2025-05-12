"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Bot, ChevronDown, User, FileCode, MoreVertical, Edit, Trash, Plus, ArrowRight, Flame } from "lucide-react";
import { MarkdownMessage } from "@/components/markdown-message";
import { AnimatePresence, motion } from "framer-motion";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ModelOption {
  id: string;
  name: string;
  description: string;
  icon: string;
}

// Add new ChatSession interface
interface ChatSession {
  id: string;
  model: ModelOption;
  messages: Message[];
  createdAt: number;
  locked: boolean;
  customTitle?: string;
}

export default function ChatPage() {
  useEffect(() => {
    const timer = setTimeout(() => {
      if (typeof window !== 'undefined') {
        window.location.href = "https://chat.tekir.co";
      }
    }, 1300);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background text-foreground">
      <div className="flex flex-col items-center space-y-4">
        <p className="text-lg font-medium justify-center">Redirecting you to the new chat experience...</p>
        <Link href="https://chat.tekir.co" className="text-blue-500 hover:underline">
          Didn't get redirected?
        </Link>
      </div>
    </div>
  );
}
