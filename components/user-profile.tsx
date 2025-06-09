"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import { User, LogOut, LogIn, Settings, LucideIcon } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { generateInitialsAvatar, generateAvatarUrl, getUserAvatarUrl } from "@/lib/avatar";

interface MobileNavItem {
  href: string;
  icon: LucideIcon;
  label: string;
}

interface UserProfileProps {
  mobileNavItems?: MobileNavItem[];
  showOnlyAvatar?: boolean;
}

export default function UserProfile({ mobileNavItems = [], showOnlyAvatar = false }: UserProfileProps) {
  const { data: session, status, update } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [avatarKey, setAvatarKey] = useState(Date.now()); // For forcing avatar refresh
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

  // Force avatar refresh when session user data changes
  useEffect(() => {
    if (session?.user) {
      setAvatarKey(Date.now());
    }
  }, [session?.user?.image, session?.user?.imageType, (session?.user as any)?.updatedAt]);

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

  if (status === "loading") {
    return (
      <div className={`${showOnlyAvatar ? 'w-10 h-10' : 'w-8 h-8'} rounded-full bg-muted animate-pulse flex-shrink-0`}></div>
    );
  }

  if (!session) {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center ${showOnlyAvatar ? 'p-0' : 'gap-2 px-3 py-2'} rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors`}
        >
          <div className={`${showOnlyAvatar ? 'w-10 h-10' : 'w-8 h-8'} rounded-full overflow-hidden border-2 border-muted bg-muted flex items-center justify-center flex-shrink-0`}>
            <User className={`${showOnlyAvatar ? 'w-5 h-5' : 'w-4 h-4'} text-muted-foreground`} />
          </div>
          {!showOnlyAvatar && (
            <span className="hidden sm:block">Guest</span>
          )}
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-2 w-48 rounded-lg bg-background border border-border shadow-lg z-50">
            <div className="p-3 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-muted bg-muted flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">
                    Guest User
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    Welcome to Tekir ID
                  </p>
                </div>
              </div>
            </div>
            
            {/* Mobile navigation items - only show on mobile */}
            {mobileNavItems.length > 0 && (
              <div className="py-1 md:hidden border-b border-border">
                {mobileNavItems.map((item, index) => (
                  <Link
                    key={index}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
            
            <div className="py-1">
              <Link
                href="/auth/signin"
                onClick={() => setIsOpen(false)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <LogIn className="w-4 h-4" />
                Sign in
              </Link>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center ${showOnlyAvatar ? 'p-0' : 'gap-2 px-3 py-2'} rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors`}
      >
        <div className={`${showOnlyAvatar ? 'w-10 h-10' : 'w-8 h-8'} rounded-full overflow-hidden border-2 border-muted flex-shrink-0`}>
          <Image
            key={`avatar-${session.user?.id}-${avatarKey}`}
            src={getUserAvatarUrl({
              id: session.user?.id,
              image: session.user?.image,
              imageType: (session.user as any)?.imageType,
              email: session.user?.email,
              name: session.user?.name,
              updatedAt: (session.user as any)?.updatedAt
            })}
            alt={session.user?.name || "Profile"}
            width={showOnlyAvatar ? 40 : 32}
            height={showOnlyAvatar ? 40 : 32}
            className="w-full h-full object-cover"
            unoptimized={true}
            priority={false}
            onError={(e) => {
              // Fallback to DiceBear avatar if image fails to load
              const target = e.target as HTMLImageElement;
              const userId = (session.user as any)?.id;
              target.src = userId 
                ? generateAvatarUrl(userId, session.user?.email || undefined)
                : generateInitialsAvatar(session.user?.name || session.user?.email || "User");
            }}
          />
        </div>
        {!showOnlyAvatar && (
          <span className="hidden sm:block truncate">
            {session.user?.name || "User"}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 rounded-lg bg-background border border-border shadow-lg z-50">
          <div className="p-3 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-muted flex-shrink-0">
                <Image
                  key={`dropdown-avatar-${session.user?.id}-${avatarKey}`}
                  src={getUserAvatarUrl({
                    id: session.user?.id,
                    image: session.user?.image,
                    imageType: (session.user as any)?.imageType,
                    email: session.user?.email,
                    name: session.user?.name,
                    updatedAt: (session.user as any)?.updatedAt
                  })}
                  alt={session.user?.name || "Profile"}
                  width={40}
                  height={40}
                  className="w-full h-full object-cover"
                  unoptimized={true}
                  priority={false}
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    const userId = (session.user as any)?.id;
                    target.src = userId 
                      ? generateAvatarUrl(userId, session.user?.email || undefined)
                      : generateInitialsAvatar(session.user?.name || session.user?.email || "User");
                  }}
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">
                  {session.user?.name}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {(session.user as any)?.username ? `@${(session.user as any)?.username}` : session.user?.email}
                </p>
              </div>
            </div>
          </div>
          
          {/* Mobile navigation items - only show on mobile */}
          {mobileNavItems.length > 0 && (
            <div className="py-1 md:hidden border-b border-border">
              {mobileNavItems.map((item, index) => (
                <Link
                  key={index}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Link>
              ))}
            </div>
          )}
          
          <div className="py-1">
            <Link
              href="/settings/account"
              onClick={() => setIsOpen(false)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Settings className="w-4 h-4" />
              Account Settings
            </Link>
            
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
