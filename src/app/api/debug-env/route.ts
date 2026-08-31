import { NextResponse } from "next/server";

export function GET() {
  const pick = (k: string) => {
    const v = process.env[k];
    if (!v) return { present: false };
    return { present: true, length: v.length, preview: v.slice(0, 6) };
  };
  return NextResponse.json({
    AUTH_SECRET: pick("AUTH_SECRET"),
    AUTH_GOOGLE_ID: pick("AUTH_GOOGLE_ID"),
    AUTH_GOOGLE_SECRET: pick("AUTH_GOOGLE_SECRET"),
    DATABASE_URL: pick("DATABASE_URL"),
    AUTH_URL: pick("AUTH_URL"),
    APP_URL: pick("APP_URL"),
  });
}
