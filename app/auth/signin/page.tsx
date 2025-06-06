"use client";

import { useState } from "react";
import { signIn, getSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Eye, EyeOff } from "lucide-react";

export default function SignInPage() {
  const [email, setEmail] = useState("");
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
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        // Handle email verification error specifically
        if (result.error.includes("verify your email")) {
          setError(`${result.error}. Need to verify your email?`);
        } else {
          setError("Invalid email or password");
        }
      } else {
        // Wait for session to be established
        await getSession();
        router.push("/");
      }
    } catch (error) {
      setError("An error occurred. Please try again.");
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
              src="/tekir-head.png"
              alt="Tekir Logo"
              width={80}
              height={80}
              className="mx-auto"
            />
          </Link>
          <h2 className="mt-6 text-3xl font-bold text-foreground">
            Sign in to Tekir
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link
              href="/auth/signup"
              className="text-primary hover:underline"
            >
              Sign up
            </Link>
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-md text-sm">
              {error}
              {error.includes("verify your email") && (
                <div className="mt-2">
                  <Link 
                    href={`/auth/verify-email?email=${encodeURIComponent(email)}`}
                    className="text-primary hover:underline font-medium"
                  >
                    Go to email verification →
                  </Link>
                </div>
              )}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="sr-only">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="relative block w-full px-3 py-3 border border-border placeholder-muted-foreground text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-background"
                placeholder="Email address"
              />
            </div>

            <div className="relative">
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="relative block w-full px-3 py-3 pr-10 border border-border placeholder-muted-foreground text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-background"
                placeholder="Password"
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
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </div>

          <div className="text-center">
            <Link
              href="/"
              className="text-sm text-muted-foreground hover:text-primary"
            >
              ← Back to home
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
