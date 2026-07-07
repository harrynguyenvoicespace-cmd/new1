import type { NextConfig } from "next";

const isStaticExport = process.env.NEXT_STATIC_EXPORT === "1";

const nextConfig: NextConfig = {
  output: isStaticExport ? "export" : "standalone",
  ...(isStaticExport
    ? {
        images: {
          unoptimized: true,
        },
        trailingSlash: true,
      }
    : {}),
  allowedDevOrigins: ["127.0.0.1", "localhost", "192.168.1.28", "192.168.1.40"],
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
