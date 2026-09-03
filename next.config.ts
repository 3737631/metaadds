import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ejecutamos como aplicación Next.js con servidor en Vercel,
  // por lo que NO usamos `output: export` (necesitamos API routes
  // y acceso a secretos en el servidor).
  images: { unoptimized: true },
};

export default nextConfig;
