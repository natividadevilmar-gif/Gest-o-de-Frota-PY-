import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
  // Fotos de recibo chegam reduzidas (~300 KB), mas deixamos folga.
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
};

export default nextConfig;
