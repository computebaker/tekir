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
  
  async rewrites() {
    console.log('Convex proxy disabled - using direct connections');
    return [];
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
