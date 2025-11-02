'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { CheckCircle2, Loader2, XCircle, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/auth-provider';

type VerificationState = 'loading' | 'success' | 'error' | 'retry';

interface SubscriptionInfo {
  status: string;
  currentPeriodEnd: number;
  product: {
    name: string;
  };
}

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { checkAuthStatus } = useAuth();
  const [state, setState] = useState<VerificationState>('loading');
  const [message, setMessage] = useState('Verifying your subscription...');
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const verifyCheckout = async () => {
    try {
      setState('loading');
      setMessage('Verifying your subscription...');

      const response = await fetch('/api/polar/verify-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setState('success');
        setMessage(data.message || 'Subscription activated successfully!');
        setSubscription(data.subscription || null);
        
        // Refresh auth to update user roles
        await checkAuthStatus(true);
      } else if (data.needsRetry && retryCount < 5) {
        // Webhook might not have processed yet, retry after a delay
        setState('retry');
        setMessage('Processing your subscription...');
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
        }, 2000);
      } else {
        setState('error');
        setMessage(data.message || data.error || 'Failed to verify subscription');
      }
    } catch (error) {
      console.error('Verification error:', error);
      setState('error');
      setMessage('An unexpected error occurred. Please try again.');
    }
  };

  useEffect(() => {
    verifyCheckout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryCount]);

  const handleContinue = () => {
    router.push('/settings/account');
  };

  const handleContactSupport = () => {
    router.push('/settings/account');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4">
              {state === 'loading' || state === 'retry' ? (
                <Loader2 className="w-16 h-16 text-primary animate-spin mx-auto" />
              ) : state === 'success' ? (
                <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-10 h-10 text-white" />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-full bg-destructive flex items-center justify-center mx-auto">
                  <XCircle className="w-10 h-10 text-white" />
                </div>
              )}
            </div>
            <CardTitle className="text-2xl">
              {state === 'loading' || state === 'retry'
                ? 'Processing Subscription'
                : state === 'success'
                ? 'Welcome to Tekir Plus!'
                : 'Verification Issue'}
            </CardTitle>
            <CardDescription className="text-base mt-2">
              {message}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {state === 'success' && subscription && (
              <div className="space-y-4">
                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Plan</span>
                    <span className="font-medium">{subscription.product?.name || 'Tekir Plus'}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Status</span>
                    <span className="font-medium capitalize">{subscription.status}</span>
                  </div>
                  {subscription.currentPeriodEnd && (
                    <div className="flex justify-between items-center text-sm pt-2 border-t">
                      <span className="text-muted-foreground">Next billing</span>
                      <span className="font-medium">
                        {new Date(subscription.currentPeriodEnd * 1000).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </span>
                    </div>
                  )}
                </div>
                <Button 
                  onClick={handleContinue} 
                  className="w-full" 
                  size="lg"
                >
                  Continue to Settings
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </div>
            )}

            {state === 'error' && (
              <div className="space-y-4">
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-sm text-muted-foreground text-center">
                    If you just completed payment, please wait a few moments and try again.
                    Your subscription may still be processing.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button onClick={verifyCheckout} variant="outline" className="flex-1">
                    Retry Verification
                  </Button>
                  <Button onClick={handleContactSupport} className="flex-1">
                    View Account
                  </Button>
                </div>
              </div>
            )}

            {(state === 'loading' || state === 'retry') && retryCount > 0 && (
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-sm text-muted-foreground text-center">
                  Attempt {retryCount} of 5... Please wait while we confirm your subscription.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
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
