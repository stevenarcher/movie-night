import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { badRequest, ok, serverError, unauthorized } from "@/lib/api";
import { isAdmin } from "@/lib/admin";
import { validateTitle } from "@/whatsapp/validate";
import { tmdbMeta, tmdbOffers } from "@/lib/tmdb";
import { revalidateTag } from "next/cache";
import { TAG_CANDIDATES } from "@/lib/queries";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return unauthorized();
  if (!await isAdmin(session.user.id)) return unauthorized("Admin access required");

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
    const meta = await tmdbMeta(validation.title);
    const offers = meta.matchedId ? await tmdbOffers(meta.matchedId, validation.title) : [];

    const candidate = await prisma.candidate.create({
      data: {
        title: validation.title,
        normalizedTitle: validation.normalizedTitle,
        source: "MANUAL",
        addedByUserId: session.user.id,
        metadata: {
          posterUrl: meta.posterUrl ?? undefined,
          trailerUrl: meta.trailerUrl ?? undefined,
          actors: meta.actors.length > 0 ? meta.actors : undefined,
          directors: meta.directors.length > 0 ? meta.directors : undefined,
          offers,
        },
      },
    });
    revalidateTag(TAG_CANDIDATES, "max");
    return ok({ candidate });
  } catch (error) {
    console.error("[dashboard/pool] create failed", error);
    return serverError("Failed to add movie");
  }
}
