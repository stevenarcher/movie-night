import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { currentWeek } from "@/lib/week";
import { movieMeta } from "@/lib/movie-meta";
import { sendGroupMessage } from "@/whatsapp/send";
import { normalizeTitle } from "@/whatsapp/normalize";
import { badRequest, conflict, ok, serverError, unauthorized } from "@/lib/api";

/**
 * Locks in this week's movie.
 *
 * The random pick happens server-side so the result is fair, then the client
 * animates its wheel to the returned winner. Only one screening per week is
 * allowed (unique weekNumber) — a second attempt gets 409.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return unauthorized();

  const week = currentWeek();

  const existing = await prisma.screening.findUnique({
    where: { year_weekNumber: { year: week.year, weekNumber: week.weekNumber } },
  });
  if (existing) {
    return conflict(
      `A movie is already locked for week ${week.weekNumber} of ${week.year}: "${existing.movieTitle}".`,
    );
  }

  const candidates = await prisma.candidate.findMany({
    select: { id: true, title: true, metadata: true },
  });
  if (candidates.length === 0) {
    return conflict("The candidate pool is empty — add movies before spinning.");
  }

  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  const pickedMeta = movieMeta(pick.metadata);

  const screening = await prisma.$transaction(async (tx) => {
    const created = await tx.screening.create({
      data: {
        year: week.year,
        weekNumber: week.weekNumber,
        weekStart: week.weekStart,
        movieTitle: pick.title,
        candidateId: pick.id,
        selectedByUserId: session.user!.id,
        // Carry the poster, trailer, and watch links over from the candidate so
        // they survive the move into the archive (the candidate row is deleted).
        metadata: {
          posterUrl: pickedMeta.posterUrl,
          trailerUrl: pickedMeta.trailerUrl,
          offers: pickedMeta.offers,
        },
      },
    });
    await tx.candidate.delete({ where: { id: pick.id } }).catch(() => {});
    return created;
  }).catch(async (error: unknown) => {
    const code = (error as { code?: string }).code;
    if (code === "P2002") {
      const locked = await prisma.screening.findUnique({
        where: { year_weekNumber: { year: week.year, weekNumber: week.weekNumber } },
      });
      return { conflict: locked ?? null };
    }
    throw error;
  });

  if ("conflict" in screening) {
    return conflict(
      screening.conflict
        ? `A movie is already locked for week ${week.weekNumber} of ${week.year}: "${screening.conflict.movieTitle}".`
        : "A movie is already locked for this week.",
    );
  }

  // Announce to the WhatsApp group (fire-and-forget; non-fatal on failure).
  void sendGroupMessage(
    `🎬 Movie Night week ${week.weekNumber} of ${week.year} is… "${screening.movieTitle}"!`,
  ).catch(() => {});

  return ok({
    screening: {
      id: screening.id,
      weekNumber: screening.weekNumber,
      movieTitle: screening.movieTitle,
      posterUrl: pickedMeta.posterUrl,
      trailerUrl: pickedMeta.trailerUrl,
      offers: pickedMeta.offers,
    },
  });
}

/**
 * Unlocks this week's movie so the wheel can be spun again. The screening is
 * removed and the picked title is returned to the candidate pool. Only safe for
 * the current, unrated week — past weeks cannot be reopened.
 */
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) return unauthorized();

  const week = currentWeek();

  const existing = await prisma.screening.findUnique({
    where: { year_weekNumber: { year: week.year, weekNumber: week.weekNumber } },
    select: { id: true, movieTitle: true, metadata: true },
  });
  if (!existing) {
    return badRequest("No movie is locked in for this week yet.");
  }

  const normalizedTitle = normalizeTitle(existing.movieTitle);

  const alreadyInPool = await prisma.candidate.findUnique({ where: { normalizedTitle } });
  if (alreadyInPool) {
    return badRequest("That movie is already back in the pool — only the locked pick can be reset.");
  }

  const restored = movieMeta(existing.metadata);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.candidate.create({
        data: {
          title: existing.movieTitle,
          normalizedTitle,
          source: "MANUAL",
          metadata: {
            ...((existing.metadata as object | null) ?? {}),
            note: "Restored after resetting this week's spin",
            posterUrl: restored.posterUrl ?? undefined,
            trailerUrl: restored.trailerUrl ?? undefined,
            offers: restored.offers,
          },
        },
      });
      await tx.screening.delete({ where: { id: existing.id } });
    });
  } catch (error) {
    console.error("[select] reset failed", error);
    return serverError("Failed to reset the week");
  }

  return ok({ removed: existing.movieTitle });
}