/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,

  // ⚡ Ignorar warnings molestos de Supabase
  webpack: (config) => {
    config.ignoreWarnings = [
      /Critical dependency: the request of a dependency is an expression/,
    ];
    return config;
  },
};

module.exports = nextConfig;
