import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Self-contained server bundle for Docker / serverless deploys.
  output: "standalone",
  // three.js ships ESM; transpile for older bundling paths
  transpilePackages: ["three"],
  // Lint is run separately; don't let it block production builds.
  eslint: { ignoreDuringBuilds: true },
  // Avoid the multi-lockfile workspace-root warning seen in dev logs
  outputFileTracingRoot: __dirname,
  async rewrites() {
    const api = process.env.API_PROXY_TARGET || "http://localhost:8000";
    return [{ source: "/api/:path*", destination: `${api}/api/:path*` }];
  },
};

export default nextConfig;
