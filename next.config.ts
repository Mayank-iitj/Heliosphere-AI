import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Self-contained server bundle for Docker / serverless / Vercel deploys.
  output: "standalone",
  // three.js ships ESM; transpile for older bundling paths
  transpilePackages: ["three"],
  // Lint and TS errors don't block production builds (CI handles them separately)
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  // Avoid the multi-lockfile workspace-root warning in dev logs
  outputFileTracingRoot: __dirname,

  async rewrites() {
    const api = process.env.API_PROXY_TARGET || "http://localhost:8000";
    return {
      // Native Next.js route handlers take priority; these rewrites only run
      // if no matching app/api/* route file exists.
      beforeFiles: [],
      afterFiles: [
        // Forward all /api/* paths that are NOT handled natively to FastAPI.
        // /api/copilot/ask is handled natively (src/app/api/copilot/ask/route.ts)
        // and will NOT reach this rewrite.
        { source: "/api/:path*", destination: `${api}/api/:path*` },
      ],
      fallback: [],
    };
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            // Allow Sketchfab iframe + Groq API + Vercel analytics
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "frame-src 'self' https://sketchfab.com https://*.sketchfab.com",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://sketchfab.com https://*.sketchfab.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https://sketchfab.com https://*.sketchfab.com",
              "media-src 'self' blob: https://sketchfab.com https://*.sketchfab.com",
              "connect-src 'self' https://api.groq.com https://sketchfab.com https://*.sketchfab.com https://swpc.noaa.gov https://services.swpc.noaa.gov",
              "worker-src 'self' blob:",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
