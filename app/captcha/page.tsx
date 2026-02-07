'use client';

import Image from 'next/image';
import { useEffect, useRef, useState, useCallback } from 'react';
import posthog from 'posthog-js';

// Type definition for the Ribaunt widget element
interface RibauntWidgetElement extends HTMLElement {
  reset(): void;
  getState(): string;
  startVerification(): void;
}

export default function CaptchaPage() {
  const widgetRef = useRef<RibauntWidgetElement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [widgetLoaded, setWidgetLoaded] = useState(false);
  const [heading, setHeading] = useState('Let\'s verify you before proceeding.');
  const [returnUrl, setReturnUrl] = useState('/');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [hostname, setHostname] = useState('localhost:3000');

  // Get the return URL from either query param or current pathname
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Set the hostname for display
    setHostname(window.location.host);
    
    // Parse URL search params directly from window.location
    const urlParams = new URLSearchParams(window.location.search);
    let url = urlParams.get('returnUrl');
    
    // If no query param, use the current pathname (for rewritten pages)
    if (!url) {
      url = window.location.pathname;
    }
    
    // Default to home
    if (!url || url === '/captcha') {
      url = '/';
    }
    
    // Security: Only allow relative paths starting with /
    if (!url.startsWith('/') || url.startsWith('//')) {
      url = '/';
    }
    
    console.log('Return URL set to:', url);
    setReturnUrl(url);

    posthog.capture('captcha_viewed', {
      return_url: url,
      path: window.location.pathname,
    });
  }, []);

  // Theme detection
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check localStorage for theme preference
    const storedTheme = localStorage.getItem('theme');
    let detectedTheme: 'light' | 'dark';
    
    if (storedTheme === 'dark' || storedTheme === 'light') {
      detectedTheme = storedTheme;
    } else {
      // If no stored theme, check device preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      detectedTheme = prefersDark ? 'dark' : 'light';
    }

    setTheme(detectedTheme);

    // Apply theme to ribaunt-widget CSS custom properties
    const root = document.documentElement;
    
    // Reset all theme variables first
    root.style.removeProperty('--ribaunt-background');
    root.style.removeProperty('--ribaunt-border-color');
    root.style.removeProperty('--ribaunt-color');
    root.style.removeProperty('--ribaunt-checkbox-background');
    root.style.removeProperty('--ribaunt-spinner-color');
    root.style.removeProperty('--ribaunt-spinner-background-color');
    root.style.removeProperty('--ribaunt-logo-color');

    if (detectedTheme === 'dark') {
      root.style.setProperty('--ribaunt-background', '#2d2d2d');
      root.style.setProperty('--ribaunt-border-color', '#555');
      root.style.setProperty('--ribaunt-color', '#ffffff');
      root.style.setProperty('--ribaunt-checkbox-background', '#444');
      root.style.setProperty('--ribaunt-spinner-color', '#fff');
      root.style.setProperty('--ribaunt-spinner-background-color', '#333');
      root.style.setProperty('--ribaunt-logo-color', '#ccc');
    }
  }, []);

  // Callback ref to get the widget element when it's mounted
  const widgetCallbackRef = useCallback((element: HTMLElement | null) => {
    if (element && !widgetRef.current) {
      console.log('Widget element mounted:', element);
      widgetRef.current = element as RibauntWidgetElement;
      setWidgetLoaded(true);

      posthog.capture('captcha_widget_mounted', {
        return_url: returnUrl,
      });
    }
  }, []);

  useEffect(() => {
    if (!widgetLoaded || !widgetRef.current) {
      return;
    }

    const widget = widgetRef.current;
    console.log('Setting up widget event listeners');

    // Listen for verification success
    const verifyHandler = async (e: Event) => {
      console.log('Verify event received:', e);
      setHeading('Continuing to your destination...');

      // Capture captcha verified event in PostHog
      posthog.capture('captcha_verified', {
        return_url: returnUrl,
      });

      console.log('Redirecting to:', returnUrl);

      setTimeout(() => {
        posthog.capture('captcha_redirected', {
          return_url: returnUrl,
        });
        window.location.href = returnUrl;
      }, 300);
    };

    // Listen for errors
    const errorHandler = (e: Event) => {
      console.error('Widget error:', e);
      posthog.capture('captcha_error', {
        source: 'widget',
        return_url: returnUrl,
        message: (e as CustomEvent)?.detail?.message ?? 'widget_error',
      });
    };

    // Listen for state changes
    const stateChangeHandler = (e: Event) => {
      const customEvent = e as CustomEvent;
      console.log('Widget state changed to:', customEvent.detail?.state);

      posthog.capture('captcha_state_change', {
        state: customEvent.detail?.state ?? 'unknown',
        return_url: returnUrl,
      });
      
      if (customEvent.detail?.state === 'verified') {
        setHeading('Continuing to your destination...');
        
        setTimeout(() => {
          posthog.capture('captcha_redirected', {
            return_url: returnUrl,
          });
          window.location.href = returnUrl;
        }, 300);
      } else if (customEvent.detail?.state === 'initial') {
        setHeading('Verifying you are a human before proceeding...');
      }
    };

    widget.addEventListener('verify', verifyHandler);
    widget.addEventListener('error', errorHandler);
    widget.addEventListener('state-change', stateChangeHandler);

    return () => {
      widget.removeEventListener('verify', verifyHandler);
      widget.removeEventListener('error', errorHandler);
      widget.removeEventListener('state-change', stateChangeHandler);
    };
  }, [widgetLoaded, returnUrl]);

  useEffect(() => {
    // Import the widget dynamically (client-side only)
    import('ribaunt/widget')
      .then(() => {
        console.log('Widget script loaded successfully');
        setIsLoading(false);

        posthog.capture('captcha_widget_loaded', {
          return_url: returnUrl,
        });
      })
      .catch((err) => {
        console.error('Failed to load CAPTCHA widget:', err);
        posthog.capture('captcha_error', {
          source: 'widget_load',
          message: err instanceof Error ? err.message : 'Unknown error',
          return_url: returnUrl,
        });
        setHeading('Failed to load verification widget. Please refresh the page.');
        setIsLoading(false);
      });
  }, []);

  // Get current date
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  return (
    <>
      <style jsx global>{`
        body {
          background-color: ${theme === 'dark' ? '#0a0a0a' : '#ffffff'} !important;
          color: ${theme === 'dark' ? '#ededed' : '#171717'} !important;
        }
      `}</style>
      <style jsx>{`
        * {
          box-sizing: border-box;
        }
        .container {
          max-width: 690px;
          margin: 3em auto;
          padding: 18px;
          font-family: system-ui;
          background-color: ${theme === 'dark' ? '#0a0a0a' : '#ffffff'};
        }
        .title-container {
          display: flex;
          align-items: center;
          gap: 11px;
          margin-bottom: 0px;
        }
        .site-logo {
          width: 30px;
          height: 30px;
          border-radius: 6px;
        }
        h1 {
          font-weight: 600;
          font-size: 26px;
          margin-bottom: 0px;
        }
        h2 {
          font-weight: 400;
          font-size: 20px;
          margin-top: 7px;
          margin-bottom: 1.5em;
          color: ${theme === 'dark' ? '#ededed' : '#171717'};
        }
        .widget-container {
          margin-bottom: 2em;
        }
        hr {
          border: 0;
          border-top: 1px solid ${theme === 'dark' ? '#333333' : '#dddddd8f'};
          margin: 2em 0;
        }
        h3 {
          font-weight: 600;
          font-size: 18px;
          margin-top: 1.5em;
          margin-bottom: 0px;
        }
        p {
          font-weight: 400;
          font-size: 16px;
          line-height: 1.5;
          margin-top: 10px;
          color: ${theme === 'dark' ? '#ededed' : '#171717'};
        }
        footer {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        footer .credit {
          display: flex;
          gap: 8px;
          align-items: center;
          text-decoration: none;
          color: ${theme === 'dark' ? '#ededed' : '#171717'};
        }
        footer .credit:hover {
          opacity: 0.7;
        }
        footer .credit img {
          width: 26px;
          height: 26px;
        }
        footer .date {
          font-size: 15px;
          color: ${theme === 'dark' ? '#888' : '#888'};
          margin: 0px;
          margin-left: auto;
        }
        .loading {
          color: ${theme === 'dark' ? '#ccc' : '#666'};
          font-size: 14px;
        }
      `}</style>

      <div className="container">
        <div className="title-container">
          <Image
            src="/favicon.ico"
            alt="Site logo"
            className="site-logo"
            width={30}
            height={30}
            onError={(e) => {
              // Hide the image on error to preserve original behavior
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
          <h1>{hostname}</h1>
        </div>
        <h2>{heading}</h2>

        <div className="widget-container">
          {isLoading ? (
            <div className="loading">Loading verification widget...</div>
          ) : (
            <ribaunt-widget
              ref={widgetCallbackRef}
              id="captcha-widget"
              challenge-endpoint="/api/captcha/challenge"
              verify-endpoint="/api/captcha/verify"
              show-warning="false"
            />
          )}
        </div>
        <noscript>
          <style>{`
            .info {
              display: none;
            }
            a {
              color: ${theme === 'dark' ? '#4a9eff' : '#0a91e7'};
            }
            h3 {
              line-height: 1.3;
              margin-bottom: 1em;
            }
          `}</style>
          <h3>
            JavaScript is disabled and we were unable to verify you. To access this page, please{' '}
            <a
              href="https://www.whatismybrowser.com/guides/how-to-enable-javascript/auto"
              target="_blank"
              rel="nofollow noopener"
            >
              enable JavaScript
            </a>
          </h3>
          <hr />
        </noscript>

        <div className="info">
          <hr />

          <h3>Why am I seeing this page?</h3>
          <p>
            To keep this site secure, we need to confirm your request is coming from a legitimate
            source. This will be a quick check to help stop abuse.
          </p>

          <h3>What should I do?</h3>
          <p>
            No action is required on your end. Once verified, you&apos;ll continue to your destination.
            If you&apos;re stuck, try refreshing the page or checking your connection.
          </p>

          <hr />
        </div>

        <footer>
          <a
            href="https://ribaunt.com"
            target="_blank"
            rel="noopener"
            className="credit"
          >
            <span>Secured by Ribaunt</span>
          </a>
          <p className="date">{currentDate}</p>
        </footer>
      </div>
    </>
  );
}
