import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { movieMeta } from "@/lib/movie-meta";
import { ok, unauthorized } from "@/lib/api";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return unauthorized();

  const screenings = await prisma.screening.findMany({
    orderBy: { weekNumber: "desc" },
    select: {
      id: true,
      weekNumber: true,
      weekStart: true,
      movieTitle: true,
      metadata: true,
      createdAt: true,
      ratings: { select: { value: true, userId: true } },
    },
  });

  const archive = screenings.map((s) => {
    const values = s.ratings.map((r) => r.value);
    const count = values.length;
    const average = count > 0 ? values.reduce((a, b) => a + b, 0) / count : null;
    const meta = movieMeta(s.metadata);
    const myRating = s.ratings.find((r) => r.userId === session.user!.id)?.value ?? null;
    return {
      id: s.id,
      weekNumber: s.weekNumber,
      weekStart: s.weekStart,
      movieTitle: s.movieTitle,
      posterUrl: meta.posterUrl,
      trailerUrl: meta.trailerUrl,
      offers: meta.offers,
      createdAt: s.createdAt,
      averageRating: average === null ? null : Math.round(average * 100) / 100,
      ratingCount: count,
      myRating,
    };
  });

  return ok({ screenings: archive, total: archive.length });
}