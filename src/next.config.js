/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Prevent server-only packages from being bundled into the client or edge bundles.
  // kafkajs is handled separately via webpackIgnore in lib/kafka.ts.
  serverExternalPackages: ["pg", "pg-pool", "geoip-lite"],
  experimental: {
    instrumentationHook: true,
  },
};

module.exports = nextConfig;
