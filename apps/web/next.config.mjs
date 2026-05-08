/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  transpilePackages: ['@nextgen/utils', '@nextgen/types'],
};

export default nextConfig;
