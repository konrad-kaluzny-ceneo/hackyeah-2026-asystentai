import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "image.ceneostatic.pl",
        port: "",
        pathname: "/data/products/*/p-product.jpg",
        search: "",
      },
      {
        protocol: "https",
        hostname: "picsum.photos",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "image.ceneostatic.pl",
        pathname: "/data/products/**",
      },
    ],
  },
};

export default nextConfig;
