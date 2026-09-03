import type { NextConfig } from "next";

import { assertServerEnvironment } from "./src/lib/config/env";
import { getSecurityHeaders } from "./src/lib/security/headers";

assertServerEnvironment();

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.68.108"],
  async headers() {
    return [{
      source: "/:path*",
      headers: getSecurityHeaders(process.env.VERCEL_ENV === "production")
    }];
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "6mb"
    }
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com"
      },
      {
        protocol: "https",
        hostname: "commons.wikimedia.org"
      },
      {
        protocol: "https",
        hostname: "upload.wikimedia.org"
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com"
      },
      {
        protocol: "https",
        hostname: "**.supabase.co"
      }
    ]
  }
};

export default nextConfig;
