"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, Loader2, Sparkles, CreditCard, Calendar, XCircle, ExternalLink, AlertCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface SubscriptionManagerProps {
  productId?: string;
  organizationName?: string;
}

interface SubscriptionInfo {
  id: string;
  status: string;
  currentPeriodEnd: number;
  cancelAtPeriodEnd: boolean;
  product?: {
    name: string;
    description: string;
  };
  price?: {
    amount: number;
    currency: string;
    recurring: {
      interval: string;
      intervalCount: number;
    };
  };
}

export default function SubscriptionManager({
  productId = process.env.NEXT_PUBLIC_POLAR_PRODUCT_ID || '',
  organizationName = process.env.NEXT_PUBLIC_POLAR_ORGANIZATION || 'tekir',
}: SubscriptionManagerProps) {
  const { user } = useAuth();
  const t = useTranslations('subscription');
  const [loading, setLoading] = useState(false);
  const [checkingSubscription, setCheckingSubscription] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const isPaid = user?.roles?.some((role: string) => role.toLowerCase() === 'paid');

  // Features list
  const features = [
    t('features.increasedLimits'),
    t('features.moreSearchOptions'),
    t('features.prioritySupport'),
    t('features.prioritizedFeedback')
  ];

  // Check for active subscription when user is paid
  useEffect(() => {
    const checkSubscription = async () => {
      if (!isPaid) {
        setCheckingSubscription(false);
        return;
      }

      await fetchSubscriptionData();
    };

    checkSubscription();
  }, [isPaid]);

  const fetchSubscriptionData = async () => {
    try {
      setError(null);
      const response = await fetch('/api/polar/subscription', {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.hasSubscription && data.subscription) {
          setSubscription(data.subscription);
        } else {
          setSubscription(null);
        }
      } else {
        setError('Failed to fetch subscription data');
      }
    } catch (err) {
      console.error('Failed to fetch subscription:', err);
      setError('Network error while fetching subscription');
    } finally {
      setCheckingSubscription(false);
      setLastFetched(new Date());
    }
  };

  const handleUpgrade = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/polar/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || t('errors.checkoutFailed'));
      }

      // Redirect to Polar checkout
      window.location.href = data.checkoutUrl;
    } catch (err) {
      console.error('Upgrade error:', err);
      setError(err instanceof Error ? err.message : t('errors.upgradeFailed'));
      setLoading(false);
    }
  };

  const formatPrice = (amount: number, currency: string, interval: string, intervalCount: number) => {
    const formattedAmount = (amount / 100).toFixed(2);
    const currencySymbol = currency === 'usd' ? '$' : currency.toUpperCase();
    const intervalText = intervalCount === 1 ? interval : `${intervalCount} ${interval}s`;
    return `${currencySymbol}${formattedAmount}/${intervalText}`;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Free user view - show upgrade option
  if (!isPaid) {
    return (
      <Card className="border-2 border-border hover:border-primary/50 transition-colors">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-primary" />
              <CardTitle>{t('title')}</CardTitle>
            </div>
            <div className="text-lg font-bold px-3 py-1 border rounded-md bg-primary/5">
              {t('price')}
            </div>
          </div>
          <CardDescription>
            {t('description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {features.map((feature, index) => (
              <div key={index} className="flex items-start gap-3">
                <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <span className="text-sm">{feature}</span>
              </div>
            ))}
          </div>
        </CardContent>
        <CardFooter className="flex-col gap-3">
          {error && (
            <div className="w-full p-3 text-sm bg-destructive/10 text-destructive rounded-md flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          <Button
            onClick={handleUpgrade}
            disabled={loading || !user}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t('actions.loading')}
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                {t('actions.upgrade')}
              </>
            )}
          </Button>
          {!user && (
            <p className="text-xs text-muted-foreground text-center">
              {t('actions.signInRequired')}
            </p>
          )}
        </CardFooter>
      </Card>
    );
  }

  // Paid user view - show subscription info
  if (checkingSubscription) {
    return (
      <Card className="border-2 border-primary/20">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="ml-2 text-sm text-muted-foreground">{t('status.loading')}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle>{t('title')}</CardTitle>
            <CardDescription className="text-primary/80 font-medium">
              {t('activeSubscription')}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Subscription Status */}
        <div className="p-4 bg-background/50 rounded-lg border border-primary/20">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-sm font-medium">{t('status.title')}: {t('status.active')}</span>
            </div>
            <div className="px-3 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full">
              {t('plusMember')}
            </div>
          </div>
          
          {/* Billing Information */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <CreditCard className="w-4 h-4" />
                <span>{t('billing.cycle')}</span>
              </div>
              <span className="font-medium">{t('billing.monthly')}</span>
            </div>
            
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <span>{t('billing.nextInvoice')}</span>
              </div>
              <span className="font-medium">
                {subscription?.currentPeriodEnd 
                  ? formatDate(subscription.currentPeriodEnd)
                  : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })
                }
              </span>
            </div>
          </div>
        </div>

        {/* Features Included */}
        <div>
          <h4 className="text-sm font-medium mb-3">{t('info.includedFeatures')}</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {features.slice(0, 4).map((feature, index) => (
              <div key={index} className="flex items-center gap-2 text-sm">
                <Check className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="text-muted-foreground">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex-col gap-3">
        {/* Manage Subscription Button */}
        <a
          href={`https://polar.sh/${organizationName}/portal`}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-background hover:bg-muted transition-colors rounded-lg border border-border text-sm font-medium"
        >
          <CreditCard className="w-4 h-4" />
          {t('actions.manage')}
          <ExternalLink className="w-3 h-3" />
        </a>

        {/* Refresh Button */}
        <Button
          onClick={() => {
            setCheckingSubscription(true);
            fetchSubscriptionData();
          }}
          variant="outline"
          size="sm"
          className="w-full"
          disabled={checkingSubscription}
        >
          {checkingSubscription ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {t('status.loading')}
            </>
          ) : (
            <>
              <Calendar className="w-4 h-4 mr-2" />
              {t('actions.refresh')}
            </>
          )}
        </Button>

        {/* Additional Info */}
        <p className="text-xs text-muted-foreground text-center">
          {t('info.manageInfo')}
        </p>
      </CardFooter>
    </Card>
  );
}
