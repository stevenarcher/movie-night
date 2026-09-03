import { currentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { movieMeta } from "@/lib/movie-meta";
import { ArchiveClient, type ScreeningView } from "@/components/ArchiveClient";

export const dynamic = "force-dynamic";

export default async function ArchivePage() {
  const user = await currentUser();

  const screenings = await prisma.screening.findMany({
    orderBy: [{ year: "desc" }, { weekNumber: "desc" }],
    select: {
      id: true,
      year: true,
      weekNumber: true,
      weekStart: true,
      movieTitle: true,
      watchOnVC: true,
      metadata: true,
      ratings: { select: { value: true, userId: true } },
    },
  });

  const views: ScreeningView[] = screenings.map((s) => {
    const values = s.ratings.map((r) => r.value);
    const count = values.length;
    const average = count > 0 ? values.reduce((a, b) => a + b, 0) / count : null;
    const meta = movieMeta(s.metadata);
    return {
      id: s.id,
      year: s.year,
      weekNumber: s.weekNumber,
      weekStart: s.watchOnVC ? s.weekStart!.toISOString() : null,
      movieTitle: s.movieTitle,
      watchOnVC: s.watchOnVC,
      posterUrl: meta.posterUrl,
      trailerUrl: meta.trailerUrl,
      offers: meta.offers,
      averageRating: average === null ? null : Math.round(average * 100) / 100,
      ratingCount: count,
      myRating: user ? s.ratings.find((r) => r.userId === user.id)?.value ?? null : null,
    };
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <div className="mb-10">
        <p className="eyebrow-accent mb-4">PAST PICKS · RATED</p>
        <h1 className="font-display text-5xl tracking-tight sm:text-6xl">Movie archive</h1>
        <p className="mt-5 max-w-xl text-muted">
          Every weekly pick, with the group&apos;s ratings. Rate your favourite nights on a 0–5
          scale, in quarter-star increments.
        </p>
      </div>

      <ArchiveClient signedIn={Boolean(user)} initialScreenings={views} />
    </div>
  );
}
