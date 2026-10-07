import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Hostinger serves the standalone server ("Detected Next.js standalone
   * server output"). Before the monorepo it switched this on itself by
   * editing the root next.config; with the app in apps/web it no longer
   * can, and the deploy failed with "no standalone server or static
   * output". So the app asks for it, and scripts/mirror-web-build.mjs lays
   * the output out where Hostinger looks (DEPLOY.md §3b).
   *
   * Traced from the monorepo root: packages are hoisted to the root
   * node_modules, and the shared packages live in /packages.
   */
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../.."),
  transpilePackages: ["@flowhrms/types", "@flowhrms/validation"],
  logging: {
    /**
     * Development only, but off on purpose: Next prints every Server
     * Function call WITH its arguments, and two of ours carry passwords —
     * the invitation page and Account → Change password. A password in a
     * terminal ends up in a pasted bug report. The request line and the
     * timing stay; only the argument dump goes.
     */
    serverFunctions: false,
  },
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,OPTIONS,PATCH,DELETE,POST,PUT" },
          { key: "Access-Control-Allow-Headers", value: "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, x-user-email, x-user-id, x-tenant-id" },
        ],
      },
      {
        /**
         * HTML must be revalidated, never served from cache blind.
         */
        source: "/((?!_next/static|_next/image|icons/|apple-icon).*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
