/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.freepik.com' },
      { protocol: 'https', hostname: '**.freepikcompany.com' },
      { protocol: 'https', hostname: '**.blob.core.windows.net' },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '20mb',
    },
  },
}

module.exports = nextConfig
