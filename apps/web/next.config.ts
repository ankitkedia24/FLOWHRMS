import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
        /**
         * HTML must be revalidated, never served from cache blind.
         *
         * Next marks prerendered pages `s-maxage=31536000` — a year — and
         * the CDN in front of us honoured it. The HTML references CSS and
         * JS by content hash, and those filenames change on every deploy.
         * So a visitor holding a cached page asks for a stylesheet that no
         * longer exists, gets a 404, and sees the site with NO styling at
         * all: serif text, links running together, no layout. It looks
         * exactly like the site is broken, and it does not heal on its own
         * for a year.
         *
         * `max-age=0, must-revalidate` keeps the cache — the entry is
         * still stored and a 304 costs almost nothing — but forces a check
         * against the origin first, so HTML and assets can never disagree
         * about which build they belong to.
         *
         * The negative lookahead deliberately spares /_next/static and the
         * generated icons: those ARE content-hashed or fixed artwork, and
         * they should stay immutable. Caching the fingerprinted files
         * aggressively is the whole point; caching the document that names
         * them is the mistake.
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
