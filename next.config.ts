import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Remote images served through next/image: TMDB posters/trailers, Google
    // avatars from OAuth sign-in, and legacy JustWatch posters still stored in
    // the DB from an older ingest path.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "image.tmdb.org",
        pathname: "/t/p/**",
      },
      {
        protocol: "https",
        hostname: "images.justwatch.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "/**",
      },
    ],
    formats: ["image/avif", "image/webp"],
  },
  headers: async () =>
    process.env.NODE_ENV === "development"
      ? []
      : [
          {
            // Hashed build artifacts never change for their lifetime. The default
            // max-age=0 forced a revalidation on every single navigation — a big
            // chunk of the per-navigation latency on a cold Netlify instance.
            //
            // Applied only in production: dev chunks use stable, unhashed
            // filenames, so an immutable header there would let the browser
            // serve stale bundles (e.g. an outdated images remotePatterns) forever.
            source: "/_next/static/:path*",
            headers: [
              {
                key: "Cache-Control",
                value: "public, max-age=31536000, immutable",
              },
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