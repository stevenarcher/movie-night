import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { badRequest, ok, serverError, unauthorized } from "@/lib/api";
import { validateTitle } from "@/whatsapp/validate";
import { tmdbPoster } from "@/lib/tmdb";
import { revalidateTag } from "next/cache";
import { getCandidates, TAG_CANDIDATES } from "@/lib/queries";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return unauthorized();

  const cached = await getCandidates();
  const candidates = cached.map((c) => ({
    id: c.id,
    title: c.title,
    source: c.source,
    createdAt: c.createdAt,
    posterUrl: c.posterUrl,
    offers: c.offers,
  }));

  return ok({ candidates, count: candidates.length });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return unauthorized();

  let body: { title?: unknown };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  if (typeof body.title !== "string") {
    return badRequest("`title` is required");
  }

  const validation = validateTitle(body.title);
  if (!validation.ok) {
    return badRequest(validation.reason);
  }

  const existing = await prisma.candidate.findUnique({
    where: { normalizedTitle: validation.normalizedTitle },
  });
  if (existing) {
    return badRequest("That movie is already in the pool");
  }

  try {
    const posterUrl = await tmdbPoster(validation.title);
    const candidate = await prisma.candidate.create({
      data: {
        title: validation.title,
        normalizedTitle: validation.normalizedTitle,
        source: "MANUAL",
        addedByUserId: session.user.id,
        metadata: { posterUrl: posterUrl ?? undefined },
      },
    });
    revalidateTag(TAG_CANDIDATES, "max");
    return ok({ candidate });
  } catch (error) {
    console.error("[pool] create failed", error);
    return serverError("Failed to add movie");
  }
}