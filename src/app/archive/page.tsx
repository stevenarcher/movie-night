import { currentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getArchive } from "@/lib/queries";
import { ArchiveClient, type ScreeningView } from "@/components/ArchiveClient";

export const dynamic = "force-dynamic";

export default async function ArchivePage() {
  const user = await currentUser();

  const { screenings } = await getArchive();

  // Per-user "my rating" depends on the signed-in user, so it must be resolved
  // per-request rather than baked into the shared archive cache.
  let myRatings: Map<string, number> = new Map();
  if (user?.id) {
    const rows = await prisma.rating.findMany({
      where: { userId: user.id },
      select: { screeningId: true, value: true },
    });
    myRatings = new Map(rows.map((r) => [r.screeningId, r.value]));
  }

  const views: ScreeningView[] = screenings.map((s) => ({
    id: s.id,
    year: s.year,
    weekNumber: s.weekNumber,
    weekStart: s.watchOnVC ? s.weekStart : null,
    movieTitle: s.movieTitle,
    watchOnVC: s.watchOnVC,
    posterUrl: s.posterUrl,
    trailerUrl: s.trailerUrl,
    offers: s.offers,
    averageRating: s.averageRating,
    ratingCount: s.ratingCount,
    myRating: user ? myRatings.get(s.id) ?? null : null,
  }));

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <div className="mb-10">
        <p className="eyebrow-accent mb-4">PAST PICKS · RATED</p>
        <h1 className="font-display text-5xl tracking-tight sm:text-6xl">Movie archive</h1>
        <p className="mt-5 max-w-xl text-muted">
          Every weekly pick, with the group&apos;s ratings. Rate your favourite nights on a 0–5
          scale, in two-decimal-star increments.
        </p>
      </div>

      <ArchiveClient signedIn={Boolean(user)} initialScreenings={views} />
    </div>
  );
}
