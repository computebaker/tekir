/**
 * OpenTelemetry Instrumentation for Next.js
 *
 * This file is automatically loaded by Next.js to set up OpenTelemetry.
 * It configures log export to PostHog via OTLP HTTP.
 *
 * Note: This only runs in server-side contexts (API routes, Server Components, etc.)
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

// Get PostHog configuration
const POSTHOG_PROJECT_TOKEN = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_OTLP_HOST || 'https://eu.i.posthog.com';

// Only initialize if we have the required credentials
if (POSTHOG_PROJECT_TOKEN) {
  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [SemanticResourceAttributes.SERVICE_NAME]: 'tekir-nextjs',
      [SemanticResourceAttributes.SERVICE_VERSION]: process.env.npm_package_version || '1.0.0',
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
    }),
    logRecordProcessor: new BatchLogRecordProcessor(
      new OTLPLogExporter({
        url: `${POSTHOG_HOST}/i/v1/logs`,
        headers: {
          'Authorization': `Bearer ${POSTHOG_PROJECT_TOKEN}`,
        },
      })
    ),
  });

  // Start the SDK (synchronous)
  try {
    sdk.start();
    if (process.env.NODE_ENV === 'development') {
      console.log('[OpenTelemetry] Logging initialized successfully');
    }
  } catch (error) {
    console.error('[OpenTelemetry] Failed to initialize:', error);
  }

  // Graceful shutdown handlers
  const shutdownHandler = () => {
    sdk.shutdown()
      .then(() => console.log('[OpenTelemetry] Shut down gracefully'))
      .catch((err) => console.error('[OpenTelemetry] Shutdown error:', err));
  };

  // Register shutdown handlers if process.on is available
  if (typeof process !== 'undefined' && typeof process.on === 'function') {
    process.on('SIGTERM', shutdownHandler);
    process.on('SIGINT', shutdownHandler);
  }
} else {
  if (process.env.NODE_ENV === 'development') {
    console.warn('[OpenTelemetry] Skipping initialization: NEXT_PUBLIC_POSTHOG_KEY not set');
  }
}

// Export required by Next.js instrumentation convention
export async function register() {
  // This function is called by Next.js to register instrumentation
  // Initialization happens at module load time above
  if (process.env.NODE_ENV === 'development') {
    console.log('[OpenTelemetry] Instrumentation registered');
  }
}

// Server-side error tracking
export const onRequestError = async (err: Error, request: Request, context: any) => {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { getPostHogServer } = await import('./lib/posthog-server');
      const posthog = getPostHogServer();
      
      let distinctId: string | null = null;
      
      if (request.headers) {
        const cookieHeader = request.headers.get('cookie');
        
        if (cookieHeader) {
          // Normalize multiple cookie arrays to string
          const cookieString = Array.isArray(cookieHeader) 
            ? cookieHeader.join('; ') 
            : cookieHeader;

          const postHogCookieMatch = cookieString.match(/ph_phc_.*?_posthog=([^;]+)/);

          if (postHogCookieMatch && postHogCookieMatch[1]) {
            try {
              const decodedCookie = decodeURIComponent(postHogCookieMatch[1]);
              const postHogData = JSON.parse(decodedCookie);
              distinctId = postHogData.distinct_id;
            } catch (e) {
              console.error('[PostHog] Error parsing PostHog cookie:', e);
            }
          }
        }
      }

      await posthog.captureException(err, distinctId || undefined, {
        $exception_type: err.name,
        $exception_message: err.message,
        $exception_stack: err.stack,
        url: (request as any).url || 'unknown',
        method: request.method,
      });
      
      if (process.env.NODE_ENV === 'development') {
        console.log('[PostHog] Captured server-side exception:', err.message);
      }
    } catch (captureError) {
      console.error('[PostHog] Failed to capture exception:', captureError);
    }
  }
};

