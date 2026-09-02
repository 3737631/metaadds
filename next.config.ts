import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";
const repo = "metaadds";

const nextConfig: NextConfig = {
  output: "export",
  // GitHub Pages serves the repo under the /metaadds/ base path.
  basePath: isProd ? `/${repo}` : "",
  assetPrefix: isProd ? `/${repo}` : "",
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
