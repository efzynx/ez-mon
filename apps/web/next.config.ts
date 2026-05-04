import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@ezmon/db", "@ezmon/shared"],
  serverExternalPackages: ["bcryptjs"],
};

export default nextConfig;
