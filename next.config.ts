import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The design system ships TypeScript source, not a build.
  transpilePackages: ["@vantage/design-system"],
};

export default nextConfig;
