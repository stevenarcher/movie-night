import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ok, unauthorized } from "@/lib/api";
import { getArchive } from "@/lib/queries";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return unauthorized();

  const { screenings } = await getArchive();

  const myRatings = await prisma.rating.findMany({
    where: { userId: session.user.id },
    select: { screeningId: true, value: true },
  });
  const myRatingById = new Map(myRatings.map((r) => [r.screeningId, r.value]));

  const archive = screenings.map((s) => ({
    id: s.id,
    year: s.year,
    weekNumber: s.weekNumber,
    weekStart: s.watchOnVC ? s.weekStart : null,
    movieTitle: s.movieTitle,
    watchOnVC: s.watchOnVC,
    posterUrl: s.posterUrl,
    trailerUrl: s.trailerUrl,
    offers: s.offers,
    actors: s.actors,
    directors: s.directors,
    averageRating: s.averageRating,
    ratingCount: s.ratingCount,
    myRating: myRatingById.get(s.id) ?? null,
  }));

  return ok({ screenings: archive, total: archive.length });
}