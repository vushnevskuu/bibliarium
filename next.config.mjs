/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Меньший клиентский бандл: подтягивать только используемые иконки.
    optimizePackageImports: ["lucide-react"],
  },
  poweredByHeader: false,
};

export default nextConfig;
