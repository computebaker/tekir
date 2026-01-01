/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable SWC minification (faster and better than Terser)
  swcMinify: true,

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
      {
        protocol: 'https',
        hostname: '**',
        port: '',
        pathname: '/**',
      },
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

  async rewrites() {
    return [];
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
