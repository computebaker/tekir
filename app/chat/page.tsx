"use client";

import { useEffect } from "react";
import Link from "next/link";

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
