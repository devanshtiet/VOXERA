import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /**
   * Next.js blocks cross-origin dev requests (including the HMR websocket
   * at /_next/webpack-hmr) unless the requesting origin is explicitly
   * allowlisted. Without this, opening the dev server via a LAN IP
   * (e.g. http://172.17.12.139:3000) instead of localhost loads the page
   * but silently breaks hot-reload — the exact "WebSocket connection to
   * '.../_next/webpack-hmr' failed" loop.
   *
   * Add your machine's LAN IP here (or a teammate's, when sharing your
   * dev server) if you need cross-device dev access. This only affects
   * `next dev` — it has no effect on production.
   */
  allowedDevOrigins: ["172.17.12.139"],
};

export default nextConfig;
