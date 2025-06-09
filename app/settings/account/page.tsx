"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { 
  ChevronDown, 
  Settings, 
  ArrowLeft, 
  Search, 
  User, 
  Shield, 
  Bell, 
  MessageCircleMore, 
  Lock, 
  Eye, 
  EyeOff, 
  AlertTriangle,
  Trash2,
  Save,
  RefreshCw
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import UserProfile from "@/components/user-profile";
import Link from "next/link";
import Image from "next/image";
import { generateInitialsAvatar, generateAvatarUrl, getUserAvatarUrl } from "@/lib/avatar";
import ImageUpload from "@/components/image-upload";

// Define mobile navigation items for settings
const settingsMobileNavItems = [
  {
    href: "/search",
    icon: Search,
    label: "Back to Search"
  },
  {
    href: "https://chat.tekir.co",
    icon: MessageCircleMore,
    label: "AI Chat"
  },
  {
    href: "/about",
    icon: Lock,
    label: "Privacy Policy"
  }
];

export default function AccountSettingsPage() {
  const { data: session, status, update } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  
  // Mobile settings dropdown state
  const [isMobileSettingsOpen, setIsMobileSettingsOpen] = useState(false);
  const mobileSettingsRef = useRef<HTMLDivElement>(null);
  
  // Form states
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  // UI states
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isRegeneratingAvatar, setIsRegeneratingAvatar] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  // Load user data when session is available
  useEffect(() => {
    if (session?.user) {
      setEmail(session.user.email || "");
      setName(session.user.name || "");
      setUsername((session.user as any)?.username || "");
    }
  }, [session]);

  // Auto-hide messages after 5 seconds
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        setMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  // Click outside handler for mobile settings dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (mobileSettingsRef.current && !mobileSettingsRef.current.contains(event.target as Node)) {
        setIsMobileSettingsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleEmailUpdate = async () => {
    if (!email.trim()) {
      setMessage({ type: 'error', text: 'Email cannot be empty' });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/user/email', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      if (response.ok) {
        await update();
        setMessage({ type: 'success', text: 'Email updated successfully' });
      } else {
        const data = await response.json();
        setMessage({ type: 'error', text: data.error || 'Failed to update email' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'An error occurred while updating email' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleNameUpdate = async () => {
    if (!name.trim()) {
      setMessage({ type: 'error', text: 'Name cannot be empty' });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/user/name', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });

      if (response.ok) {
        const data = await response.json();
        // Update the session with the new name
        await update({ name: data.name });
        setMessage({ type: 'success', text: 'Name updated successfully' });
      } else {
        const data = await response.json();
        setMessage({ type: 'error', text: data.error || 'Failed to update name' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'An error occurred while updating name' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUsernameUpdate = async () => {
    if (!username.trim()) {
      setMessage({ type: 'error', text: 'Username cannot be empty' });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/user/username', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim() }),
      });

      if (response.ok) {
        const data = await response.json();
        // Update the session with the new username
        await update({ username: data.username });
        setMessage({ type: 'success', text: 'Username updated successfully' });
      } else {
        const data = await response.json();
        setMessage({ type: 'error', text: data.error || 'Failed to update username' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'An error occurred while updating username' });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setMessage({ type: 'error', text: 'All password fields are required' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match' });
      return;
    }

    if (newPassword.length < 8) {
      setMessage({ type: 'error', text: 'New password must be at least 8 characters long' });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/user/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          currentPassword, 
          newPassword 
        }),
      });

      if (response.ok) {
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setMessage({ type: 'success', text: 'Password changed successfully' });
      } else {
        const data = await response.json();
        setMessage({ type: 'error', text: data.error || 'Failed to change password' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'An error occurred while changing password' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegenerateAvatar = async () => {
    setIsRegeneratingAvatar(true);
    try {
      const response = await fetch('/api/user/regenerate-avatar', {
        method: 'POST',
      });

      if (response.ok) {
        await update();
        setMessage({ type: 'success', text: 'Profile avatar regenerated successfully' });
      } else {
        const data = await response.json();
        setMessage({ type: 'error', text: data.error || 'Failed to regenerate avatar' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'An error occurred while regenerating avatar' });
    } finally {
      setIsRegeneratingAvatar(false);
    }
  };

  const handleUploadAvatar = async (imageData: string) => {
    setIsUploadingAvatar(true);
    try {
      const response = await fetch('/api/user/avatar/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image: imageData }),
      });

      if (response.ok) {
        await update();
        setMessage({ type: 'success', text: 'Profile picture uploaded successfully' });
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Failed to upload profile picture');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred while uploading';
      setMessage({ type: 'error', text: errorMessage });
      throw error; // Re-throw to let ImageUpload component handle the error state
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    setIsUploadingAvatar(true);
    try {
      const response = await fetch('/api/user/avatar/upload', {
        method: 'DELETE',
      });

      if (response.ok) {
        await update();
        setMessage({ type: 'success', text: 'Profile picture removed successfully' });
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Failed to remove profile picture');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred while removing';
      setMessage({ type: 'error', text: errorMessage });
      throw error; // Re-throw to let ImageUpload component handle the error state
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETE MY ACCOUNT") {
      setMessage({ type: 'error', text: 'Please type "DELETE MY ACCOUNT" to confirm' });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/user/delete', {
        method: 'DELETE',
      });

      if (response.ok) {
        // Account deleted, redirect to home page
        window.location.href = '/';
      } else {
        const data = await response.json();
        setMessage({ type: 'error', text: data.error || 'Failed to delete account' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'An error occurred while deleting account' });
    } finally {
      setIsLoading(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p className="text-muted-foreground mb-6">Please sign in to access account settings.</p>
          <Link 
            href="/search" 
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Search
          </Link>
        </div>
      </div>
    );
  }

  const userAvatarUrl = getUserAvatarUrl({
    id: session.user?.id,
    image: session.user?.image,
    imageType: (session.user as any)?.imageType,
    email: session.user?.email,
    name: session.user?.name
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link 
              href="/" 
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to home</span>
            </Link>
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              <h1 className="text-lg font-semibold">Settings</h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <UserProfile mobileNavItems={settingsMobileNavItems} />
          </div>
        </div>
      </header>

      {/* Main Layout with Sidebar */}
      <div className="container max-w-7xl py-8 px-4 sm:px-6 lg:px-8 mb-16">
        <div className="flex gap-8">
          {/* Left Sidebar */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <div className="sticky top-24">
              <div className="rounded-lg border border-border bg-card p-4 mx-2 lg:mx-0">
                <nav className="space-y-1">
                  <div className="mb-4">
                    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                      Settings
                    </h2>
                  </div>
                  
                  {/* Search Settings */}
                  <Link
                    href="/settings/search"
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-200"
                  >
                    <Search className="w-4 h-4" />
                    <span>Search</span>
                  </Link>

                  {/* Divider */}
                  <div className="my-3 border-t border-border"></div>

                  {/* Account Settings - Active */}
                  <Link
                    href="/settings/account"
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-primary/10 text-primary border border-primary/20 transition-all duration-200 hover:bg-primary/15"
                  >
                    <User className="w-4 h-4" />
                    <span className="font-medium">Account</span>
                  </Link>

                  {/* Future Settings Categories */}
                  <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground cursor-not-allowed opacity-50 hover:opacity-60 transition-opacity">
                    <Shield className="w-4 h-4" />
                    <span>Privacy</span>
                    <span className="ml-auto text-xs bg-muted px-2 py-0.5 rounded-full">Soon</span>
                  </div>

                  <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground cursor-not-allowed opacity-50 hover:opacity-60 transition-opacity">
                    <Bell className="w-4 h-4" />
                    <span>Notifications</span>
                    <span className="ml-auto text-xs bg-muted px-2 py-0.5 rounded-full">Soon</span>
                  </div>
                </nav>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            {/* Mobile Navigation */}
            <div className="lg:hidden mb-6 mx-2" ref={mobileSettingsRef}>
              <div className="relative">
                <button
                  onClick={() => setIsMobileSettingsOpen(!isMobileSettingsOpen)}
                  className="w-full flex items-center justify-between gap-2 text-sm bg-muted/50 rounded-lg px-3 py-2 border hover:bg-muted/70 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Settings className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Settings</span>
                    <span className="text-muted-foreground">/</span>
                    <span className="text-foreground font-medium">Account</span>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isMobileSettingsOpen ? 'rotate-180' : ''}`} />
                </button>
                
                {isMobileSettingsOpen && (
                  <div className="absolute top-full mt-2 w-full rounded-lg bg-background border border-border shadow-lg z-50">
                    <div className="py-1">
                      <Link
                        href="/settings/search"
                        onClick={() => setIsMobileSettingsOpen(false)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        <Search className="w-4 h-4" />
                        <span>Search</span>
                      </Link>
                      
                      <div className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left bg-muted text-foreground cursor-default">
                        <User className="w-4 h-4" />
                        <span className="font-medium">Account</span>
                      </div>
                      
                      <div className="border-t border-border my-1"></div>
                      
                      <div className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left text-muted-foreground cursor-not-allowed opacity-50">
                        <Shield className="w-4 h-4" />
                        <span>Privacy</span>
                        <span className="ml-auto text-xs bg-muted px-2 py-0.5 rounded-full">Soon</span>
                      </div>
                      
                      <div className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left text-muted-foreground cursor-not-allowed opacity-50">
                        <Bell className="w-4 h-4" />
                        <span>Notifications</span>
                        <span className="ml-auto text-xs bg-muted px-2 py-0.5 rounded-full">Soon</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Messages */}
            {message && (
              <div className={`mb-6 mx-2 lg:mx-0 p-4 rounded-lg border ${
                message.type === 'success' 
                  ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-200' 
                  : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950 dark:border-red-800 dark:text-red-200'
              }`}>
                {message.text}
              </div>
            )}

            <div className="space-y-8">
              {/* Page Title and Description */}
              <div>
                <h2 className="text-3xl font-bold tracking-tight">Account Settings</h2>
                <p className="text-muted-foreground mt-2">
                  Manage your account information, security, and preferences.
                </p>
              </div>

              {/* Settings Cards */}
              <div className="space-y-6">
                {/* Profile Information */}
                <div className="rounded-lg border border-border bg-card p-6">
                  <h3 className="text-lg font-medium mb-6">Profile Picture</h3>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Image Upload Section */}
                    <div>
                      <ImageUpload
                        currentImage={userAvatarUrl}
                        onImageUpload={handleUploadAvatar}
                        onImageRemove={handleRemoveAvatar}
                        disabled={isUploadingAvatar || isLoading}
                        size={120}
                      />
                    </div>
                    
                    {/* Alternative Options */}
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium mb-2">Alternative Options</h4>
                        <p className="text-sm text-muted-foreground mb-4">
                          Don't have a photo? You can use a generated avatar instead.
                        </p>
                        
                        <button
                          onClick={handleRegenerateAvatar}
                          disabled={isRegeneratingAvatar || isLoading || isUploadingAvatar}
                          className="inline-flex items-center gap-2 text-sm bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors disabled:opacity-50 px-4 py-2 rounded-lg border"
                        >
                          <RefreshCw className={`w-4 h-4 ${isRegeneratingAvatar ? 'animate-spin' : ''}`} />
                          Generate New Avatar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Email Settings */}
                <div className="rounded-lg border border-border bg-card p-6">
                  <h3 className="text-lg font-medium mb-4">Email Address</h3>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium mb-2">
                        Email
                      </label>
                      <div className="flex gap-3">
                        <input
                          id="email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="flex-1 px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                          placeholder="Enter your email"
                        />
                        <button
                          onClick={handleEmailUpdate}
                          disabled={isLoading || email === session.user?.email}
                          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          <Save className="w-4 h-4" />
                          Update
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Name Settings */}
                <div className="rounded-lg border border-border bg-card p-6">
                  <h3 className="text-lg font-medium mb-4">Display Name</h3>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium mb-2">
                        Name
                      </label>
                      <p className="text-sm text-muted-foreground mb-3">
                        This is the name that will be displayed publicly on your profile.
                      </p>
                      <div className="flex gap-3">
                        <input
                          id="name"
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="flex-1 px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                          placeholder="Enter your display name"
                        />
                        <button
                          onClick={handleNameUpdate}
                          disabled={isLoading || name === session.user?.name}
                          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          <Save className="w-4 h-4" />
                          Update
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Username Settings */}
                <div className="rounded-lg border border-border bg-card p-6">
                  <h3 className="text-lg font-medium mb-4">Username</h3>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="username" className="block text-sm font-medium mb-2">
                        Username
                      </label>
                      <p className="text-sm text-muted-foreground mb-3">
                        Your unique username will be displayed as @{username || 'username'} under your name.
                      </p>
                      <div className="flex gap-3">
                        <div className="flex-1 relative">
                          <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">@</span>
                          <input
                            id="username"
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-zA-Z0-9_]/g, ''))}
                            className="w-full pl-8 pr-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                            placeholder="username"
                          />
                        </div>
                        <button
                          onClick={handleUsernameUpdate}
                          disabled={isLoading || username === (session.user as any)?.username}
                          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          <Save className="w-4 h-4" />
                          Update
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Password Settings */}
                <div className="rounded-lg border border-border bg-card p-6">
                  <h3 className="text-lg font-medium mb-4">Change Password</h3>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="current-password" className="block text-sm font-medium mb-2">
                        Current Password
                      </label>
                      <div className="relative">
                        <input
                          id="current-password"
                          type={showCurrentPassword ? "text" : "password"}
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          className="w-full px-3 py-2 pr-12 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                          placeholder="Enter current password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="new-password" className="block text-sm font-medium mb-2">
                        New Password
                      </label>
                      <div className="relative">
                        <input
                          id="new-password"
                          type={showNewPassword ? "text" : "password"}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full px-3 py-2 pr-12 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                          placeholder="Enter new password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="confirm-password" className="block text-sm font-medium mb-2">
                        Confirm New Password
                      </label>
                      <div className="relative">
                        <input
                          id="confirm-password"
                          type={showConfirmPassword ? "text" : "password"}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full px-3 py-2 pr-12 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                          placeholder="Confirm new password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <button
                      onClick={handlePasswordChange}
                      disabled={isLoading || !currentPassword || !newPassword || !confirmPassword}
                      className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <Lock className="w-4 h-4" />
                      Change Password
                    </button>
                  </div>
                </div>

                {/* Danger Zone */}
                <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950 p-6">
                  <h3 className="text-lg font-medium text-red-800 dark:text-red-200 mb-4 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    Danger Zone
                  </h3>
                  
                  {!showDeleteConfirm ? (
                    <div className="space-y-4">
                      <p className="text-sm text-red-700 dark:text-red-300">
                        Once you delete your account, there is no going back. This action cannot be undone.
                      </p>
                      <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete Account
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-sm text-red-700 dark:text-red-300">
                        Please type <strong>"DELETE MY ACCOUNT"</strong> to confirm account deletion:
                      </p>
                      <input
                        type="text"
                        value={deleteConfirmText}
                        onChange={(e) => setDeleteConfirmText(e.target.value)}
                        className="w-full px-3 py-2 border border-red-300 dark:border-red-700 rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                        placeholder="Type: DELETE MY ACCOUNT"
                      />
                      <div className="flex gap-3">
                        <button
                          onClick={handleDeleteAccount}
                          disabled={isLoading || deleteConfirmText !== "DELETE MY ACCOUNT"}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          Confirm Delete
                        </button>
                        <button
                          onClick={() => {
                            setShowDeleteConfirm(false);
                            setDeleteConfirmText("");
                          }}
                          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
