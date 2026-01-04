import { PostHog } from 'posthog-node';

let posthogInstance: PostHog | null = null;

export function getPostHogServer(): PostHog {
  if (!posthogInstance) {
    posthogInstance = new PostHog(
      process.env.NEXT_PUBLIC_POSTHOG_KEY || '',
      {
        host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com',
        flushAt: 1,
        flushInterval: 0,
      }
    );
  }

  return posthogInstance;
}
