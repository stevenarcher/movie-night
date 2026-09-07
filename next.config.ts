import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Remote images served through next/image: TMDB posters/trailers and
    // Google avatars from OAuth sign-in.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "image.tmdb.org",
        pathname: "/t/p/**",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "/**",
      },
    ],
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;