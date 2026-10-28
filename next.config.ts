import type { NextConfig } from "next";
const backend = process.env.GAME_INTERNAL_URL ?? "http://127.0.0.1:3001";
const config: NextConfig = {
  skipTrailingSlashRedirect: true,
  allowedDevOrigins: ["localhost", "127.0.0.1"],
  async rewrites() {
    return [
      {
        source: "/socket.io/:path*",
        destination: `${backend}/socket.io/:path*/`,
      },
      { source: "/api/game/:path*", destination: `${backend}/api/:path*` },
    ];
  },
};
export default config;
