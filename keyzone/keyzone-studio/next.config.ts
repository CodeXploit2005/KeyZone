import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.KEYZONE_PACKAGE === "1" ? "standalone" : undefined,
  distDir: process.env.KEYZONE_BUILD_DIR || ".next",
  // Character reference uploads go through a server action.
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
  },
  // pg-boss and pg are server-only Node packages.
  serverExternalPackages: ["pg-boss", "pg"],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: process.env.KEYZONE_PRECOMPILED_CSS === "1" ? {} : {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
