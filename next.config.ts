import type { NextConfig } from "next";

const config: NextConfig = {
  output: "standalone",
  // A production build writes over .next, which breaks a dev server running
  // against the same directory. Set NEXT_DIST_DIR to build somewhere else.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  images: {
    // osu! serves all beatmap cover art from this host.
    remotePatterns: [{ protocol: "https", hostname: "assets.ppy.sh" }],
  },
};

export default config;
