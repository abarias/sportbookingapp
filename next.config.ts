import type { NextConfig } from "next";

import { assertServerEnvironment } from "./src/lib/config/env";

assertServerEnvironment();

const nextConfig: NextConfig = {
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
      }
    ]
  }
};

export default nextConfig;
