/** @type {import('next').NextConfig} */
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
      {
        protocol: 'https',
        hostname: '**',
        port: '',
        pathname: '/**',
      },
    ],
    minimumCacheTTL: 0,
  },
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
    console.log('Convex proxy disabled - using direct connections');
    return [];
  },

  webpack: (config, { isServer }) => {
    return config;
  },
};

module.exports = nextConfig;
