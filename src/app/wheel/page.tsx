import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { currentWeek } from "@/lib/week";
import { WheelClient } from "@/components/WheelClient";
import { ResetSpinButton } from "@/components/ResetSpinButton";

export const dynamic = "force-dynamic";

export default async function WheelPage() {
  await requireUser();

  const week = currentWeek();
  const [candidates, locked] = await Promise.all([
    prisma.candidate.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.screening.findUnique({
      where: { weekNumber: week.weekNumber },
      select: { movieTitle: true, weekNumber: true },
    }),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <div className="mb-12 text-center">
        <p className="eyebrow-accent mb-4">WK {week.weekNumber} · PICTURE START</p>
        <h1 className="font-display text-5xl tracking-tight sm:text-6xl">Spin the wheel</h1>
        <p className="mt-5 mx-auto max-w-md text-muted">
          The server picks the winner at random, the wheel settles on it, and the movie is locked
          for the week.
        </p>
      </div>

      {locked ? (
        <LockedPanel movieTitle={locked.movieTitle} weekNumber={locked.weekNumber} />
      ) : (
        <WheelClient
          candidates={candidates.map((c) => ({
            title: c.title,
            posterUrl: (c.metadata as { posterUrl?: string } | null)?.posterUrl ?? null,
          }))}
        />
      )}
    </div>
  );
}

function LockedPanel({ movieTitle, weekNumber }: { movieTitle: string; weekNumber: number }) {
  return (
    <div className="mx-auto max-w-md overflow-hidden rounded-xl border border-edge bg-panel p-10 text-center">
      <div className="text-4xl">🎬</div>
      <div className="slate mt-6">
        <span className="sc">TAKE 01</span>
        <span className="nm">locked</span>
      </div>
      <p className="eyebrow mt-8">Week {weekNumber} is already locked in</p>
      <h2 className="font-display mt-3 text-3xl leading-tight">{movieTitle}</h2>
      <p className="mt-5 text-sm text-muted">
        The wheel waits for next week. Everyone can rate the pick in the archive.
      </p>
      <ResetSpinButton movieTitle={movieTitle} />
    </div>
  );
}