/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.freepik.com' },
      { protocol: 'https', hostname: '**.freepikcompany.com' },
    ],
  },
}

module.exports = nextConfig
