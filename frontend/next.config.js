const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,

  webpack: (config) => {
    // ⚡ Alias para imports cortos
    config.resolve.alias["@"] = path.resolve(__dirname, "app");
    config.resolve.alias["#lib"] = path.resolve(__dirname, "lib");

    // ⚡ Ignorar warnings molestos de Supabase
    config.ignoreWarnings = [
      /Critical dependency: the request of a dependency is an expression/,
    ];

    return config;
  },
};

module.exports = nextConfig;
