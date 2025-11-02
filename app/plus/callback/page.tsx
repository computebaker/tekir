'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { CheckCircle2, Loader2, XCircle, ArrowRight, Sparkles, Zap } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/auth-provider';
import { motion } from 'framer-motion';

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
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-lg"
      >
        <Card className="border-2 shadow-2xl">
          <CardHeader className="text-center pb-4">
            <motion.div
              className="mx-auto mb-6"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            >
              {state === 'loading' || state === 'retry' ? (
                <div className="relative">
                  <Loader2 className="relative w-20 h-20 text-primary animate-spin" />
                </div>
              ) : state === 'success' ? (
                <motion.div
                  className="relative"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.3, type: "spring", stiffness: 150 }}
                >
                  <div className="relative bg-gradient-to-br from-green-500 to-emerald-600 rounded-full p-4">
                    <CheckCircle2 className="w-12 h-12 text-white" />
                  </div>
                  <motion.div
                    className="absolute -top-2 -right-2"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  >
                    <Sparkles className="w-6 h-6 text-yellow-500" />
                  </motion.div>
                </motion.div>
              ) : (
                <div className="relative">
                  <div className="relative bg-gradient-to-br from-destructive to-red-600 rounded-full p-4">
                    <XCircle className="w-12 h-12 text-white" />
                  </div>
                </div>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <CardTitle className="text-3xl font-bold bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
                {state === 'loading' || state === 'retry'
                  ? 'Processing Subscription'
                  : state === 'success'
                  ? 'Welcome to Tekir Plus!'
                  : 'Verification Issue'}
              </CardTitle>
              <CardDescription className="text-base mt-3 font-medium">
                {message}
              </CardDescription>
            </motion.div>
          </CardHeader>

          <CardContent className="space-y-4">
            {state === 'success' && subscription && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="space-y-4"
              >
                <div className="relative bg-gradient-to-br from-primary/10 via-primary/5 to-transparent rounded-xl p-5 space-y-3 border border-primary/20">
                  <div className="absolute top-2 right-2">
                    <Zap className="w-5 h-5 text-primary/40" />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-muted-foreground">Plan</span>
                    <span className="font-semibold text-primary flex items-center gap-1">
                      <Sparkles className="w-4 h-4" />
                      {subscription.product?.name || 'Tekir Plus'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-muted-foreground">Status</span>
                    <span className="font-semibold capitalize px-3 py-1 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 text-sm">
                      {subscription.status}
                    </span>
                  </div>
                  {subscription.currentPeriodEnd && (
                    <div className="flex justify-between items-center pt-2 border-t border-primary/10">
                      <span className="text-sm font-medium text-muted-foreground">Next billing</span>
                      <span className="font-semibold">
                        {new Date(subscription.currentPeriodEnd * 1000).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </span>
                    </div>
                  )}
                </div>

                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button 
                    onClick={handleContinue} 
                    className="w-full h-12 text-base font-semibold shadow-lg hover:shadow-xl transition-all bg-gradient-to-r from-primary to-primary/90" 
                    size="lg"
                  >
                    Continue to Settings
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </motion.div>
              </motion.div>
            )}

            {state === 'error' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="space-y-4"
              >
                <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4">
                  <p className="text-sm text-muted-foreground text-center leading-relaxed">
                    If you just completed payment, please wait a few moments and try again.
                    Your subscription may still be processing.
                  </p>
                </div>
                <div className="flex gap-3">
                  <Button onClick={verifyCheckout} variant="outline" className="flex-1 h-11 font-medium">
                    Retry Verification
                  </Button>
                  <Button onClick={handleContactSupport} className="flex-1 h-11 font-medium">
                    View Account
                  </Button>
                </div>
              </motion.div>
            )}

            {(state === 'loading' || state === 'retry') && retryCount > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-primary/5 border border-primary/20 rounded-lg p-4"
              >
                <p className="text-sm text-muted-foreground text-center font-medium">
                  Attempt {retryCount} of 5... Please wait while we confirm your subscription.
                </p>
                <div className="mt-3 w-full bg-muted/30 rounded-full h-2 overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-primary to-primary/60"
                    initial={{ width: "0%" }}
                    animate={{ width: `${(retryCount / 5) * 100}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </motion.div>
            )}
          </CardContent>
        </Card>
      </motion.div>
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
