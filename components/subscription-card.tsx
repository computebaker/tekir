"use client";

import { useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, Loader2, Sparkles } from 'lucide-react';

interface SubscriptionCardProps {
  productId?: string;
  title?: string;
  description?: string;
  price?: string;
  features?: string[];
}

export default function SubscriptionCard({
  productId = process.env.NEXT_PUBLIC_POLAR_PRODUCT_ID || '',
  title = 'Tekir Plus',
  description = 'Support development and unlock better features',
  price = '$5/month',
  features = [
    'Increased limits',
    'More search options',
    'Priority support'
  ],
}: SubscriptionCardProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPaid = user?.roles?.some((role: string) => role.toLowerCase() === 'paid');

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
        throw new Error(data.error || 'Failed to create checkout');
      }

      // Redirect to Polar checkout
      window.location.href = data.checkoutUrl;
    } catch (err) {
      console.error('Upgrade error:', err);
      setError(err instanceof Error ? err.message : 'Failed to start upgrade process');
      setLoading(false);
    }
  };

  if (isPaid) {
    return (
      <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <CardTitle>Pro Member</CardTitle>
          </div>
          <CardDescription>
            You have access to all premium features
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {features.map((feature, index) => (
              <div key={index} className="flex items-center gap-2">
                <Check className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="text-sm">{feature}</span>
              </div>
            ))}
          </div>
        </CardContent>
        <CardFooter>
          <div className="w-full px-4 py-2 bg-secondary/50 text-secondary-foreground rounded-md text-center text-sm font-medium">
            Active Subscription
          </div>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-border hover:border-primary/50 transition-colors">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{title}</CardTitle>
          <div className="text-lg font-bold px-3 py-1 border rounded-md">
            {price}
          </div>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {features.map((feature, index) => (
            <div key={index} className="flex items-center gap-2">
              <Check className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="text-sm">{feature}</span>
            </div>
          ))}
        </div>
      </CardContent>
      <CardFooter className="flex-col gap-2">
        {error && (
          <div className="w-full p-2 text-sm bg-destructive/10 text-destructive rounded">
            {error}
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
              Loading...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Upgrade to Pro
            </>
          )}
        </Button>
        {!user && (
          <p className="text-xs text-muted-foreground text-center">
            Please sign in to upgrade
          </p>
        )}
      </CardFooter>
    </Card>
  );
}
