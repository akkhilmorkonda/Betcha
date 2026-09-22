/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '8mb',
      // Server Actions reject any request whose Origin doesn't match Host.
      // Without these, every button through a tunnel fails silently.
      allowedOrigins: [
        'localhost:3000',
        '*.ngrok-free.app',
        '*.ngrok.app',
        '*.ngrok.io',
        '*.trycloudflare.com',
      ],
    },
  },
  // Only matters when running `next dev` behind a tunnel.
  allowedDevOrigins: [
    '*.ngrok-free.app',
    '*.ngrok.app',
    '*.ngrok.io',
    '*.trycloudflare.com',
  ],
};
export default nextConfig;
