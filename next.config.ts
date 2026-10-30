import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.4.103", "192.168.4.200"],
  // A stray package-lock.json in the user folder made Turbopack treat it as the
  // project root, which left its CSS cache stale. Pin the root to this project.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
