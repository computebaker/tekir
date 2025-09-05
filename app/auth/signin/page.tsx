"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getRedirectUrlWithFallback } from "@/lib/utils";

export default function SignInPage() {
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/signin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          emailOrUsername,
          password,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Dispatch custom event to notify AuthProvider of successful login
        window.dispatchEvent(new CustomEvent('auth-login'));
        
        // Small delay to allow AuthProvider to update before redirect
        setTimeout(() => {
          const redirectUrl = getRedirectUrlWithFallback('/');
          router.push(redirectUrl);
        }, 100);
      } else {
        setError(data.error || "Invalid credentials");
      }
    } catch (error: any) {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          <Link href="/" className="inline-block">
            <Image
              src="/tekir-outlined.png"
              alt="Tekir Logo"
              width={80}
              height={80}
              className="mx-auto"
            />
          </Link>
          <h2 className="mt-6 text-3xl font-bold text-foreground">
            Sign in to your account
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Need an account?{" "}
            <Link className="text-primary hover:underline" href="/auth/signup">
              Sign up
            </Link>
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 p-4">
              <div className="text-sm text-red-700">{error}</div>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="emailOrUsername" className="sr-only">
                Email or Username
              </label>
              <Input
                id="emailOrUsername"
                type="text"
                autoComplete="username"
                required
                className="relative block w-full px-3 py-3"
                placeholder="Email or Username"
                name="emailOrUsername"
                value={emailOrUsername}
                onChange={(e) => setEmailOrUsername(e.target.value)}
              />
            </div>

            <div className="relative">
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                className="relative block w-full px-3 py-3 pr-10"
                placeholder="Password"
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <Eye className="h-5 w-5 text-muted-foreground" />
                )}
              </button>
            </div>
          </div>

          <div>
            <Button type="submit" disabled={loading} className="w-full py-3">
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </div>

          <div className="text-center">
            <Link
              className="text-sm text-muted-foreground hover:text-primary"
              href="/"
            >
              ← Back to home
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
