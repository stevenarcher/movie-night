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
  headers: async () => [
    {
      // Hashed build artifacts never change for their lifetime. The default
      // max-age=0 forced a revalidation on every single navigation — a big
      // chunk of the per-navigation latency on a cold Netlify instance.
      source: "/_next/static/:path*",
      headers: [
        { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
      ],
    },
    {
      source: "/favicon.ico",
      headers: [
        { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
      ],
    },
  ],
};

export default nextConfig;