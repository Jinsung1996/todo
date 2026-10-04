import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Default "bottom-left" overlaps the sidebar's user profile area.
  devIndicators: {
    position: "bottom-right",
  },
};

export default nextConfig;
