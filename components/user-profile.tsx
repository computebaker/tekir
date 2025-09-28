"use client";

import { useAuth } from "@/components/auth-provider";
import Link from "next/link";
import Image from "next/image";
import { User, LogOut, LogIn, Settings, LucideIcon, LayoutDashboard, Coins } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { generateInitialsAvatar, generateAvatarUrl, getUserAvatarUrl } from "@/lib/avatar";
import { storeRedirectUrl } from "@/lib/utils";

interface MobileNavItem {
  href: string;
  icon: LucideIcon;
  label: string;
}

interface UserProfileProps {
  mobileNavItems?: MobileNavItem[];
  showOnlyAvatar?: boolean;
  avatarSize?: number;
}

export default function UserProfile({ mobileNavItems = [], showOnlyAvatar = false, avatarSize }: UserProfileProps) {
  const { user, status, signOut, updateUser } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [avatarKey, setAvatarKey] = useState(Date.now()); // For forcing avatar refresh
  const [limitInfo, setLimitInfo] = useState<{ limit: number; remaining: number } | null>(null);
  const [limitLoading, setLimitLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const avatarPx = showOnlyAvatar ? (avatarSize ?? 40) : 32;

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

  // Force avatar refresh when user data changes
  useEffect(() => {
    if (user) {
      setAvatarKey(Date.now());
    }
  }, [user]);

  // Fetch session rate limit status when menu opens
  useEffect(() => {
    let aborted = false;
    if (isOpen) {
      setLimitLoading(true);
      (async () => {
        try {
          const res = await fetch('/api/session/status', { method: 'GET', credentials: 'include' });
          if (res.ok) {
            const j = await res.json();
            if (!aborted && typeof j.limit === 'number' && typeof j.remaining === 'number') {
              setLimitInfo({ limit: j.limit, remaining: j.remaining });
            }
          }
        } catch {}
        if (!aborted) setLimitLoading(false);
      })();
    } else {
      setLimitLoading(false);
    }
    return () => { aborted = true; };
  }, [isOpen]);

  // Helper function to determine if we should use Next.js Image or regular img
  const shouldUseNextImage = (src: string) => {
    // Use regular img for DiceBear URLs to hit API directly
    return !src.includes('api.dicebear.com');
  };

  if (status === "loading") {
    return (
      <div
        className={`${showOnlyAvatar ? 'w-10 h-10' : 'w-8 h-8'} rounded-full bg-muted animate-pulse flex-shrink-0`}
        style={{ width: avatarPx, height: avatarPx }}
        aria-label="Loading user profile"
        title="Loading user profile"
      />
    );
  }

  if (status === "unauthenticated" || !user) {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center ${showOnlyAvatar ? 'p-0' : 'gap-2 px-3 py-2'} rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors`}
        >
          <div
            className={`${showOnlyAvatar ? 'w-10 h-10' : 'w-8 h-8'} rounded-full overflow-hidden border-2 border-muted bg-muted flex items-center justify-center flex-shrink-0`}
            style={{ width: avatarPx, height: avatarPx }}
          >
            <User className={`${showOnlyAvatar ? 'w-5 h-5' : 'w-4 h-4'} text-muted-foreground`} aria-label="Guest user profile" />
          </div>
          {!showOnlyAvatar && (
            <span className="hidden sm:block">Guest</span>
          )}
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-2 w-48 rounded-lg bg-background border border-border shadow-lg z-50">
            <div className="p-3 border-b border-border">
              <Link
                href="/auth/signin"
                className="flex items-center gap-3 hover:bg-muted/50 transition-colors rounded-md p-2 -m-2 cursor-pointer"
                onClick={() => {
                  storeRedirectUrl();
                  setIsOpen(false);
                }}
              >
                <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-muted bg-muted flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-muted-foreground" aria-label="Guest user profile" />
                </div>
                <div>
                  <p className="text-sm font-medium">Guest</p>
                  <p className="text-xs text-muted-foreground">Not signed in</p>
                </div>
              </Link>
            </div>
            
            <div className="p-1">
              {/* Usage indicator as a menu item for guests */}
              {limitLoading && (
                <div className="flex items-center gap-2 px-3 py-2 text-sm rounded-md cursor-default select-none">
                  <Coins className="w-4 h-4 text-muted-foreground/40 animate-pulse" />
                  <span className="inline-block h-3 w-16 rounded bg-muted/50 animate-pulse" aria-hidden="true" />
                </div>
              )}
              {!limitLoading && limitInfo && (
                <div className="relative group" role="group" aria-label="Usage indicator">
                  <div
                    className="flex items-center gap-2 px-3 py-2 text-sm rounded-md select-none focus:outline-none focus:ring-2 focus:ring-ring/50"
                    tabIndex={0}
                    aria-describedby="guest-usage-tooltip"
                  >
                    {(() => {
                      const pct = limitInfo.limit > 0 ? limitInfo.remaining / limitInfo.limit : 0;
                      const iconColor = pct <= 0.1 ? 'text-red-500' : pct <= 0.3 ? 'text-yellow-500' : 'text-green-500';
                      return <Coins className={`w-4 h-4 ${iconColor}`} />;
                    })()}
                    <span className="tabular-nums">
                      <span>{limitInfo.remaining}</span>
                      <span className="text-muted-foreground">/</span>
                      <span className="text-muted-foreground">{limitInfo.limit}</span>
                    </span>
                  </div>
                  <div
                    role="tooltip"
                    id="guest-usage-tooltip"
                    className="pointer-events-none absolute right-full top-1/2 -translate-y-1/2 mr-2 w-64 whitespace-normal rounded-md border border-border bg-card text-card-foreground shadow-lg p-2 text-xs opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity z-50"
                  >
                    This is the amount of requests you have remaining for the day. A search typically costs around 6 requests.
                  </div>
                </div>
              )}
              <Link
                href="/auth/signin"
                className="flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors w-full text-left"
                onClick={() => {
                  storeRedirectUrl();
                  setIsOpen(false);
                }}
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
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center ${showOnlyAvatar ? 'p-0' : 'gap-2 px-3 py-2'} rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors`}
      >
        <div
          className={`${showOnlyAvatar ? 'w-10 h-10' : 'w-8 h-8'} rounded-full overflow-hidden border-2 border-border flex-shrink-0`}
          style={{ width: avatarPx, height: avatarPx }}
          aria-label={`${user.name || user.email || "User"} profile`}
          title={`${user.name || user.email || "User"} profile`}
        >
          {(() => {
            const avatarUrl = getUserAvatarUrl({
              id: user.id,
              image: user.image,
              imageType: (user as any).imageType,
              email: user.email,
              name: user.name,
              updatedAt: (user as any).updatedAt
            });

            if (shouldUseNextImage(avatarUrl)) {
              return (
                <Image
                  key={`avatar-${user.id}-${avatarKey}`}
                  src={avatarUrl}
                  alt={user.name || "Profile"}
                  width={avatarPx}
                  height={avatarPx}
                  className="w-full h-full object-cover"
                  unoptimized
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    const userId = user.id;
                    target.src = user.image
                      ? generateAvatarUrl(userId, user.email || undefined)
                      : generateInitialsAvatar(user.name || user.email || "User");
                  }}
                />
              );
            }
            return (
              <Image
                key={`avatar-${user.id}-${avatarKey}`}
                src={avatarUrl}
                alt={user.name || "Profile"}
                width={avatarPx}
                height={avatarPx}
                className="w-full h-full object-cover"
                unoptimized
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  const userId = user.id;
                  target.src = user.image
                    ? generateAvatarUrl(userId, user.email || undefined)
                    : generateInitialsAvatar(user.name || user.email || "User");
                }}
              />
            );
          })()}
        </div>
        {!showOnlyAvatar && (
          <span className="hidden sm:block truncate max-w-24">
            {user.name || "User"}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 rounded-lg bg-background border border-border shadow-lg z-50">
          <div className="p-3 border-b border-border">
            <Link
              href="/settings/account"
              className="flex items-center gap-3 hover:bg-muted/50 transition-colors rounded-md p-2 -m-2 cursor-pointer"
              onClick={() => {
                storeRedirectUrl(window.location.href);
                setIsOpen(false);
              }}
            >
              <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-border flex-shrink-0" aria-label={`${user.name || user.email || "User"} profile`} title={`${user.name || user.email || "User"} profile`}>
                {(() => {
                  const dropdownAvatarUrl = getUserAvatarUrl({
                    id: user.id,
                    image: user.image,
                    imageType: (user as any).imageType,
                    email: user.email,
                    name: user.name,
                    updatedAt: (user as any).updatedAt
                  });

                  if (shouldUseNextImage(dropdownAvatarUrl)) {
                    return (
                      <Image
                        key={`dropdown-avatar-${user.id}-${avatarKey}`}
                        src={dropdownAvatarUrl}
                        alt={user.name || "Profile"}
                        width={40}
                        height={40}
                        className="w-full h-full object-cover"
                        unoptimized
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          const userId = user.id;
                          target.src = user.image
                            ? generateAvatarUrl(userId, user.email || undefined)
                            : generateInitialsAvatar(user.name || user.email || "User");
                        }}
                      />
                    );
                  }
                  return (
                    <Image
                      key={`dropdown-avatar-${user.id}-${avatarKey}`}
                      src={dropdownAvatarUrl}
                      alt={user.name || "Profile"}
                      width={40}
                      height={40}
                      className="w-full h-full object-cover"
                      unoptimized
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        const userId = user.id;
                        target.src = user.image
                          ? generateAvatarUrl(userId, user.email || undefined)
                          : generateInitialsAvatar(user.name || user.email || "User");
                      }}
                    />
                  );
                })()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user.name || "User"}</p>
                <p className="text-xs text-muted-foreground truncate">
                  @{(user as any).username || user.email?.split('@')[0] || "user"}
                </p>
                {/* Removed header usage indicator per request */}
              </div>
            </Link>
          </div>
          
          <div className="p-1">
            {Array.isArray((user as any).roles) && (user as any).roles.includes('admin') && (
              <Link
                href="/admin/analytics"
                className="flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors w-full text-left"
                onClick={() => setIsOpen(false)}
              >
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </Link>
            )}
            <Link
              href="/settings/search"
              className="flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors w-full text-left"
              onClick={() => {
                storeRedirectUrl(window.location.href);
                setIsOpen(false);
              }}
            >
              <Settings className="w-4 h-4" />
              Settings
            </Link>

            {/* Usage indicator as a menu item */}
            {limitLoading && (
              <div className="flex items-center gap-2 px-3 py-2 text-sm rounded-md cursor-default select-none">
                <Coins className="w-4 h-4 text-muted-foreground/40 animate-pulse" />
                <span className="inline-block h-3 w-16 rounded bg-muted/50 animate-pulse" aria-hidden="true" />
              </div>
            )}
            {!limitLoading && limitInfo && (
              <div className="relative group" role="group" aria-label="Usage indicator">
                <div
                  className="flex items-center gap-2 px-3 py-2 text-sm rounded-md select-none focus:outline-none focus:ring-2 focus:ring-ring/50"
                  tabIndex={0}
                  aria-describedby="auth-usage-tooltip"
                >
                  {(() => {
                    const pct = limitInfo.limit > 0 ? limitInfo.remaining / limitInfo.limit : 0;
                    const iconColor = pct <= 0.1 ? 'text-red-500' : pct <= 0.3 ? 'text-yellow-500' : 'text-green-500';
                    return <Coins className={`w-4 h-4 ${iconColor}`} />;
                  })()}
                  <span className="tabular-nums">
                    <span>{limitInfo.remaining}</span>
                    <span className="text-muted-foreground">/</span>
                    <span className="text-muted-foreground">{limitInfo.limit}</span>
                  </span>
                </div>
                <div
                  role="tooltip"
                  id="auth-usage-tooltip"
                  className="pointer-events-none absolute right-full top-1/2 -translate-y-1/2 mr-2 w-64 whitespace-normal rounded-md border border-border bg-card text-card-foreground shadow-lg p-2 text-xs opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity z-50"
                >
                  This is the amount of requests you have remaining for the day. A search typically costs around 6 requests.
                </div>
              </div>
            )}
            
            <div className="border-t border-border mt-1 pt-1">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  signOut();
                }}
                className="flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors w-full text-left text-muted-foreground hover:text-foreground"
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
