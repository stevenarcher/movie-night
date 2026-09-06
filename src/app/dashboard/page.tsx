import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { movieMeta } from "@/lib/movie-meta";
import { DashboardClient, type UserView, type CandidateView, type ScreeningView } from "@/components/DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await requireAdmin();

  const [users, candidates, screenings] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, email: true, image: true, createdAt: true },
    }),
    prisma.candidate.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, source: true, createdAt: true, metadata: true },
    }),
    prisma.screening.findMany({
      orderBy: [{ year: "desc" }, { weekNumber: "desc" }],
      select: {
        id: true,
        year: true,
        weekNumber: true,
        movieTitle: true,
        votes: true,
        metadata: true,
      },
    }),
  ]);

  const userViews: UserView[] = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    image: u.image,
    createdAt: u.createdAt.toISOString(),
  }));

  const candidateViews: CandidateView[] = candidates.map((c) => {
    const meta = movieMeta(c.metadata);
    return {
      id: c.id,
      title: c.title,
      source: c.source,
      createdAt: c.createdAt.toISOString(),
      posterUrl: meta.posterUrl,
      trailerUrl: meta.trailerUrl,
    };
  });

  const screeningViews: ScreeningView[] = screenings.map((s) => {
    const meta = movieMeta(s.metadata);
    return {
      id: s.id,
      year: s.year,
      weekNumber: s.weekNumber,
      movieTitle: s.movieTitle,
      votes: s.votes,
      posterUrl: meta.posterUrl,
      trailerUrl: meta.trailerUrl,
    };
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <div className="mb-10">
        <p className="eyebrow-accent mb-4">ADMIN</p>
        <h1 className="font-display text-5xl tracking-tight sm:text-6xl">Dashboard</h1>
        <p className="mt-5 max-w-xl text-muted">
          Manage users, pool movies, and archived picks. Enrich metadata, add or remove movies from the pool.
        </p>
      </div>

      <DashboardClient
        initialUsers={userViews}
        initialCandidates={candidateViews}
        initialScreenings={screeningViews}
      />
    </div>
  );
}
