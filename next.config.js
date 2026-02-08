/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV === 'development';

const contentSecurityPolicy = (isDev
  ? `
    default-src 'self';
    script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com;
    script-src-attr 'none';
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: https: blob:;
    font-src 'self' data:;
    connect-src 'self' https: wss: blob:;
    base-uri 'self';
    object-src 'none';
    frame-ancestors 'none';
  `
  : `
    default-src 'self';
    script-src 'self' 'unsafe-inline';
    script-src-attr 'none';
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: https: blob:;
    font-src 'self' data:;
    connect-src 'self' https: wss: blob:;
    base-uri 'self';
    object-src 'none';
    frame-ancestors 'none';
  `
)
  .replace(/\s{2,}/g, ' ')
  .trim();

const extraImageHosts = (process.env.NEXT_PUBLIC_IMAGE_HOSTS || '')
  .split(',')
  .map((host) => host.trim())
  .filter(Boolean);

const nextConfig = {

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'api.dicebear.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'i.ytimg.com',
        port: '',
        pathname: '/**',
      },
      ...extraImageHosts.map((hostname) => ({
        protocol: 'https',
        hostname,
        port: '',
        pathname: '/**',
      })),
    ],
    minimumCacheTTL: 0,
  },

  // Only transpile packages that truly need it (undici for Node fetch in older environments)
  transpilePackages: ['undici'],

  experimental: {
    turbopackUseBuiltinBabel: true,
  },

  // Set build-time environment variables
  env: {
    // Auto-generate i18n cache version if not explicitly set
    NEXT_PUBLIC_I18N_CACHE_VERSION: process.env.NEXT_PUBLIC_I18N_CACHE_VERSION || `v${Date.now()}`,
  },

  skipTrailingSlashRedirect: true,

  async rewrites() {
    return [
      {
        source: '/ph/static/:path*',
        destination: 'https://eu-assets.i.posthog.com/static/:path*',
      },
      {
        source: '/ph/:path*',
        destination: 'https://eu.i.posthog.com/:path*',
      }
    ];
  },

  webpack: (config, { isServer }) => {
    return config;
  },

  async headers() {
    return [
      {
        // Static JS/CSS assets with content hash - cache forever
        source: '/:path*.(js|css|json|woff|woff2|ttf|otf)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          }
        ]
      },
      {
        // Static assets in _next directory (Next.js build artifacts)
        source: '/_next/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          }
        ]
      },
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: contentSecurityPolicy
          },
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()'
          }
        ]
      }
    ];
  }
};

module.exports = nextConfig;
