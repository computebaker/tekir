const defaultRuntimeCaching = require('next-pwa/cache');
const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  runtimeCaching: [
    {
      urlPattern: /^\/api\/pars\/.*$/i,
      handler: 'NetworkOnly',
    },
    {
      urlPattern: /^\/api\/autocomplete\/.*$/i,
      handler: 'NetworkOnly',
    },
    ...defaultRuntimeCaching,
  ],
});

/** @type {import('next').NextConfig} */
const nextConfig = {  
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  transpilePackages: ['undici'],
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

module.exports = withPWA(nextConfig);
