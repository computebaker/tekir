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
  
  async rewrites() {
    console.log('Convex proxy disabled - using direct connections');
    return [];
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
