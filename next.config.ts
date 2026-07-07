import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  allowedDevOrigins: ['127.0.0.1', 'localhost', '192.168.1.28', '192.168.1.40'],
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;


