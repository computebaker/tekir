/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { 
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'api.dicebear.com',
        port: '',
        pathname: '/**',
      },
    ],
    minimumCacheTTL: 0, // Disable caching for profile images
  },
  transpilePackages: ['undici'],
  
  // Proxy configuration for Convex WebSocket connections
  async rewrites() {
    const useProxy = process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_USE_CONVEX_PROXY === 'true';
    
    if (!useProxy || !process.env.NEXT_PUBLIC_CONVEX_URL) {
      console.log('Convex proxy disabled - using direct connections');
      return [];
    }

    console.log('Convex proxy enabled - routing through /api/convex/*');
    return [
      {
        source: '/api/convex/:path*',
        destination: `${process.env.NEXT_PUBLIC_CONVEX_URL}/:path*`,
      },
    ];
  },

  turbopack: {
    rules: {
      '**/node_modules/undici/**/*.{js,mjs}': {
        loaders: ['babel-loader'],
        as: '*.js',
      },
    },
  },
  webpack: (config, { isServer }) => {
    config.module.rules.push({
      test: /\.m?js$/,
      include: /node_modules[\\/]undici/,
      use: {
        loader: 'babel-loader',
        options: {
          presets: ['next/babel'],
        },
      },
    });
    return config;
  },
};

module.exports = nextConfig;
