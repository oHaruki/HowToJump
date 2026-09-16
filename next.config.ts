import type { NextConfig } from "next";

const config: NextConfig = {
  output: "standalone",
  images: {
    // osu! serves all beatmap cover art from this host.
    remotePatterns: [{ protocol: "https", hostname: "assets.ppy.sh" }],
  },
};

export default config;
