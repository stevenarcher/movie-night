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
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-8 text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-muted">Week {week.weekNumber}</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Spin the wheel</h1>
        <p className="mt-2 text-muted">
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
    <div className="mx-auto max-w-md rounded-3xl border border-edge bg-panel p-10 text-center">
      <p className="text-5xl">🎬</p>
      <p className="mt-4 text-sm text-muted">Week {weekNumber} is already locked in —</p>
      <p className="mt-2 text-2xl font-bold">{movieTitle}</p>
      <p className="mt-6 text-sm text-muted">
        The wheel waits for next week. Everyone can rate the pick in the archive.
      </p>
      <ResetSpinButton movieTitle={movieTitle} />
    </div>
  );
}