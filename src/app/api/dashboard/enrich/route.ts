import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { badRequest, ok, serverError, unauthorized } from "@/lib/api";
import { isAdmin } from "@/lib/admin";
import { tmdbMeta, tmdbOffers } from "@/lib/tmdb";
import { revalidateTag } from "next/cache";
import { TAG_ARCHIVE, TAG_CANDIDATES } from "@/lib/queries";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return unauthorized();
  if (!await isAdmin(session.user.id)) return unauthorized("Admin access required");

  let body: { type?: unknown; id?: unknown };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  if (body.type !== "candidate" && body.type !== "screening") {
    return badRequest("`type` must be \"candidate\" or \"screening\"");
  }
  if (typeof body.id !== "string" || !body.id) {
    return badRequest("`id` is required");
  }

  try {
    if (body.type === "candidate") {
      const candidate = await prisma.candidate.findUnique({ where: { id: body.id } });
      if (!candidate) return badRequest("Candidate not found");

      const meta = await tmdbMeta(candidate.title);
      const offers = meta.matchedId ? await tmdbOffers(meta.matchedId, candidate.title) : [];

      const existing = (candidate.metadata ?? {}) as { posterUrl?: string; trailerUrl?: string; offers?: unknown[] };
      const mergedOffers = (offers.length > 0 ? offers : (existing.offers ?? [])) as Prisma.InputJsonValue;
      const updated = await prisma.candidate.update({
        where: { id: body.id },
        data: {
          metadata: {
            posterUrl: meta.posterUrl ?? existing.posterUrl ?? undefined,
            trailerUrl: meta.trailerUrl ?? existing.trailerUrl ?? undefined,
            offers: mergedOffers,
          },
        },
      });
      revalidateTag(TAG_CANDIDATES, "max");
      return ok({ metadata: updated.metadata });
    }

    const screening = await prisma.screening.findUnique({ where: { id: body.id } });
    if (!screening) return badRequest("Screening not found");

    const meta = await tmdbMeta(screening.movieTitle);
    const offers = meta.matchedId ? await tmdbOffers(meta.matchedId, screening.movieTitle) : [];

    const existing = (screening.metadata ?? {}) as { posterUrl?: string; trailerUrl?: string; offers?: unknown[] };
    const mergedOffers = (offers.length > 0 ? offers : (existing.offers ?? [])) as Prisma.InputJsonValue;
    const updated = await prisma.screening.update({
      where: { id: body.id },
      data: {
        metadata: {
          posterUrl: meta.posterUrl ?? existing.posterUrl ?? undefined,
          trailerUrl: meta.trailerUrl ?? existing.trailerUrl ?? undefined,
          offers: mergedOffers,
        },
      },
    });
    revalidateTag(TAG_ARCHIVE, "max");
    return ok({ metadata: updated.metadata });
  } catch (error) {
    console.error("[dashboard/enrich] failed", error);
    return serverError("Failed to enrich metadata");
  }
}
