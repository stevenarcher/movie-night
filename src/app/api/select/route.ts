import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { currentWeek } from "@/lib/week";
import { movieMeta } from "@/lib/movie-meta";
import { sendGroupMessage } from "@/whatsapp/send";
import { normalizeTitle } from "@/whatsapp/normalize";
import { badRequest, conflict, ok, serverError, unauthorized } from "@/lib/api";

import type { SelectionMethod } from "@prisma/client";

/**
 * Locks in this week's movie via one of three methods:
 *   SPIN  — random server-side pick (default, backwards-compatible)
 *   VOTE  — the candidate with the most votes wins
 *   MANUAL — the caller picks a specific candidate
 *
 * Only one screening per week is allowed (unique weekNumber).
 */
export async function POST(req: Request) {
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

  // Parse optional body — SPIN needs no body, VOTE needs nothing extra, MANUAL needs candidateId.
  let method: SelectionMethod = "SPIN";
  let manualCandidateId: string | undefined;
  try {
    const body = await req.json();
    if (body?.method === "VOTE") method = "VOTE";
    else if (body?.method === "MANUAL") {
      method = "MANUAL";
      manualCandidateId = body?.candidateId;
    }
  } catch {
    // No body or unparseable — default to SPIN.
  }

  const candidates = await prisma.candidate.findMany({
    select: { id: true, title: true, metadata: true },
  });
  if (candidates.length === 0) {
    return conflict("The candidate pool is empty — add movies before selecting.");
  }

  let pick: (typeof candidates)[number];

  if (method === "MANUAL") {
    if (!manualCandidateId) {
      return badRequest("candidateId is required for manual selection");
    }
    const found = candidates.find((c) => c.id === manualCandidateId);
    if (!found) {
      return badRequest("Candidate not found in the pool");
    }
    pick = found;
  } else if (method === "VOTE") {
    // Count votes per candidate, pick the one with the most.
    const voteCounts = await prisma.vote.groupBy({
      by: ["candidateId"],
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    });
    if (voteCounts.length === 0) {
      return conflict("No votes have been cast yet — vote before locking.");
    }
    const top = voteCounts[0];
    // Check for a tie — if top two have the same count, reject.
    if (voteCounts.length > 1 && voteCounts[1]._count.id === top._count.id) {
      return conflict("It's a tied vote — break the tie before locking.");
    }
    const found = candidates.find((c) => c.id === top.candidateId);
    if (!found) {
      return conflict("The top-voted candidate is no longer in the pool.");
    }
    pick = found;
  } else {
    // SPIN — random pick.
    pick = candidates[Math.floor(Math.random() * candidates.length)];
  }

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
        selectionMethod: method,
        metadata: {
          posterUrl: pickedMeta.posterUrl,
          trailerUrl: pickedMeta.trailerUrl,
          offers: pickedMeta.offers,
        },
      },
    });
    await tx.candidate.delete({ where: { id: pick.id } }).catch(() => {});
    // Clean up votes for this candidate (and optionally all current votes).
    await tx.vote.deleteMany({ where: { candidateId: pick.id } });
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

  const methodVerb = method === "SPIN" ? "spun" : method === "VOTE" ? "voted" : "picked";
  void sendGroupMessage(
    `🎬 Movie Night week ${week.weekNumber} of ${week.year} is… "${screening.movieTitle}"! (${methodVerb} by ${session.user!.name ?? "someone"})`,
  ).catch(() => {});

  return ok({
    screening: {
      id: screening.id,
      weekNumber: screening.weekNumber,
      movieTitle: screening.movieTitle,
      selectionMethod: method,
      posterUrl: pickedMeta.posterUrl,
      trailerUrl: pickedMeta.trailerUrl,
      offers: pickedMeta.offers,
    },
  });
}

/**
 * Unlocks this week's movie so you can choose again. The screening is
 * removed and the picked title is returned to the candidate pool.
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
            note: "Restored after resetting this week's pick",
            posterUrl: restored.posterUrl ?? undefined,
            trailerUrl: restored.trailerUrl ?? undefined,
            offers: restored.offers,
          },
        },
      });
      await tx.screening.delete({ where: { id: existing.id } });
      // Clean up any remaining votes.
      await tx.vote.deleteMany();
    });
  } catch (error) {
    console.error("[select] reset failed", error);
    return serverError("Failed to reset the week");
  }

  return ok({ removed: existing.movieTitle });
}
