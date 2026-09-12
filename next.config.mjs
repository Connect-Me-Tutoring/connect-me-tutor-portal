/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: process.cwd(),
  output: "standalone",
  serverExternalPackages: ["sharp", "onnxruntime-node", "twilio"],
  typescript: {
    // Never ship a build that fails type checking.
    ignoreBuildErrors: false,
  },
  turbopack: {},

  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Don't resolve 'fs', 'net', 'tls' modules on the client-side
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        module: false,
        child_process: false,
      };
    }
    return config;
  },

  async headers() {
    const csp = [
      "default-src 'self'",
      // Next.js App Router injects inline hydration/RSC-streaming scripts, so
      // 'unsafe-inline' is required here without nonce plumbing through proxy.ts.
      "script-src 'self' 'unsafe-inline' https://vercel.live",
      // Several components use inline style={{...}}; Tailwind itself ships as a static file.
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.supabase.co",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://vercel.live wss://vercel.live",
      "frame-src 'self' blob: https://*.zoom.us https://vercel.live",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
      "upgrade-insecure-requests",
    ].join("; ");

    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "frame-src 'self' blob: https://*.zoom.us https://vercel.live; frame-ancestors 'self'; object-src 'none'; base-uri 'self'; form-action 'self';",
          },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Typ Fe-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "Permissions-Policy", value: "geolocation=()" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
        ],
      },
    ];
  },

  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ];
  },

  // This is required to support PostHog trailing slash API requests
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
