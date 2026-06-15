/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  // كل الصفحات ديناميكية - تُرسم وقت الطلب وليس وقت البناء (تتطلب env vars وقت الـ build)
  experimental: {},
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  images: { remotePatterns: [{ protocol: 'https', hostname: '**' }] },
};

module.exports = nextConfig;
