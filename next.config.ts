import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every page can carry decrypted vault data in the DOM/JS heap -- never
  // let the browser (or an intermediary cache) retain a snapshot of it, e.g.
  // via the back/forward cache after logout.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          { key: "Pragma", value: "no-cache" },
          { key: "Expires", value: "0" },
        ],
      },
    ];
  },
};

export default nextConfig;
