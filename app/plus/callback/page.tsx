'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';

function CallbackContent() {
  const router = useRouter();
  const { checkAuthStatus } = useAuth();

  const verifyCheckout = async () => {
    try {
      const response = await fetch('/api/polar/verify-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      // Always refresh auth and redirect to account settings
      // The webhook handles activation in the background
      await checkAuthStatus(true);
      router.push('/settings/account');
    } catch (error) {
      console.error('Verification error:', error);
      // Even on error, redirect to account settings
      await checkAuthStatus(true);
      router.push('/settings/account');
    }
  };

  useEffect(() => {
    verifyCheckout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
        <p className="text-muted-foreground">Processing your subscription...</p>
      </div>
    </div>
  );
}

export default function PlusCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    }>
      <CallbackContent />
    </Suspense>
  );
}
