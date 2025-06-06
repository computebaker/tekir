"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import { User, LogOut, LogIn, RefreshCw } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { generateInitialsAvatar, generateAvatarUrl } from "@/lib/avatar";

export default function UserProfile() {
  const { data: session, status, update } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [isRegeneratingAvatar, setIsRegeneratingAvatar] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Link session to user when they log in
  useEffect(() => {
    const linkSession = async () => {
      const userId = (session?.user as any)?.id;
      if (userId) {
        try {
          const response = await fetch('/api/session/link', {
            method: 'POST',
            credentials: 'include',
          });
          
          if (response.ok) {
            const data = await response.json();
            console.log('Session linked to user:', data);
          } else {
            console.warn('Failed to link session to user');
          }
        } catch (error) {
          console.error('Error linking session to user:', error);
        }
      }
    };

    linkSession();
  }, [(session?.user as any)?.id]); // Run when user ID changes (login/logout)

  const handleRegenerateAvatar = async () => {
    setIsRegeneratingAvatar(true);
    try {
      const response = await fetch('/api/user/regenerate-avatar', {
        method: 'POST',
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        // Update the session with the new avatar
        await update({
          ...session,
          user: {
            ...session?.user,
            image: data.avatarUrl,
          },
        });
        console.log('Avatar regenerated successfully');
      } else {
        console.error('Failed to regenerate avatar');
      }
    } catch (error) {
      console.error('Error regenerating avatar:', error);
    } finally {
      setIsRegeneratingAvatar(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="w-8 h-8 rounded-full bg-muted animate-pulse"></div>
    );
  }

  if (!session) {
    return (
      <Link
        href="/auth/signin"
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        <LogIn className="w-4 h-4" />
        <span className="hidden sm:block">Sign in</span>
      </Link>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors"
      >
        <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-muted">
          {session.user?.image ? (
            <Image
              src={session.user.image}
              alt={session.user.name || "Profile"}
              width={32}
              height={32}
              className="w-full h-full object-cover"
              onError={(e) => {
                // Fallback to DiceBear avatar if image fails to load
                const target = e.target as HTMLImageElement;
                const userId = (session.user as any)?.id;
                target.src = userId 
                  ? generateAvatarUrl(userId, session.user?.email || undefined)
                  : generateInitialsAvatar(session.user?.name || session.user?.email || "User");
              }}
            />
          ) : (
            <Image
              src={(() => {
                const userId = (session.user as any)?.id;
                return userId 
                  ? generateAvatarUrl(userId, session.user?.email || undefined)
                  : generateInitialsAvatar(session.user?.name || session.user?.email || "User");
              })()}
              alt={session.user?.name || "Profile"}
              width={32}
              height={32}
              className="w-full h-full object-cover"
            />
          )}
        </div>
        <span className="hidden sm:block">
          {session.user?.name || "User"}
        </span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 rounded-lg bg-background border border-border shadow-lg z-50">
          <div className="p-3 border-b border-border">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-muted">
                {session.user?.image ? (
                  <Image
                    src={session.user.image}
                    alt={session.user.name || "Profile"}
                    width={40}
                    height={40}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      const userId = (session.user as any)?.id;
                      target.src = userId 
                        ? generateAvatarUrl(userId, session.user?.email || undefined)
                        : generateInitialsAvatar(session.user?.name || session.user?.email || "User");
                    }}
                  />
                ) : (
                  <Image
                    src={(() => {
                      const userId = (session.user as any)?.id;
                      return userId 
                        ? generateAvatarUrl(userId, session.user?.email || undefined)
                        : generateInitialsAvatar(session.user?.name || session.user?.email || "User");
                    })()}
                    alt={session.user?.name || "Profile"}
                    width={40}
                    height={40}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {session.user?.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {session.user?.email}
                </p>
              </div>
            </div>
          </div>
          
          <div className="py-1">
            <button
              onClick={() => {
                handleRegenerateAvatar();
                setIsOpen(false);
              }}
              disabled={isRegeneratingAvatar}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRegeneratingAvatar ? 'animate-spin' : ''}`} />
              {isRegeneratingAvatar ? 'Generating...' : 'New Avatar'}
            </button>
            
            <button
              onClick={() => {
                signOut({ callbackUrl: "/" });
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
