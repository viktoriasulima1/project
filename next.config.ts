import type { NextConfig } from "next";
import { securityHeaders } from "./src/lib/security-headers";
import { devOriginConfig } from "./src/lib/dev-origins";

const isDev = process.env.NODE_ENV === 'development';
// DEV ONLY — allow a temporary Cloudflare Quick Tunnel origin so Next's
// cross-origin dev-resource protection does not 403 the tunnel's /_next/* asset
// + HMR requests (which otherwise blanks the page), and so Server Actions accept
// the tunnel origin. Empty in production: strict same-origin defaults preserved.
const dev = devOriginConfig(isDev);

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders(isDev) }];
  },
  ...(dev.allowedDevOrigins ? { allowedDevOrigins: dev.allowedDevOrigins } : {}),
  ...(dev.serverActions ? { experimental: { serverActions: dev.serverActions } } : {}),
};

export default nextConfig;
