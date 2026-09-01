import { currentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { currentWeek } from "@/lib/week";
import { movieMeta, type MovieMeta } from "@/lib/movie-meta";
import { WheelClient } from "@/components/WheelClient";
import { ResetSpinButton } from "@/components/ResetSpinButton";
import { SignInPrompt } from "@/components/SignInPrompt";

export const dynamic = "force-dynamic";

export default async function WheelPage() {
  const user = await currentUser();
  const signedIn = Boolean(user);

  const week = currentWeek();
  const [candidates, locked] = await Promise.all([
    prisma.candidate.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.screening.findUnique({
      where: { weekNumber: week.weekNumber },
      select: { movieTitle: true, weekNumber: true, metadata: true },
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
        <LockedPanel
          signedIn={signedIn}
          movieTitle={locked.movieTitle}
          weekNumber={locked.weekNumber}
          meta={movieMeta(locked.metadata)}
        />
      ) : (
        <WheelClient
          signedIn={signedIn}
          candidates={candidates.map((c) => ({
            title: c.title,
            posterUrl: movieMeta(c.metadata).posterUrl,
          }))}
        />
      )}
    </div>
  );
}

function LockedPanel({
  signedIn,
  movieTitle,
  weekNumber,
  meta,
}: {
  signedIn: boolean;
  movieTitle: string;
  weekNumber: number;
  meta: MovieMeta;
}) {
  return (
    <div className="mx-auto max-w-md overflow-hidden rounded-xl border border-edge bg-panel">
      {meta.posterUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={meta.posterUrl}
          alt={`${movieTitle} poster`}
          className="h-64 w-full border-b border-edge object-cover"
        />
      )}
      <div className="p-10 text-center">
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

        {meta.trailerUrl && (
          <a
            href={meta.trailerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex items-center gap-1.5 rounded-full border border-edge px-4 py-1.5 text-[11px] uppercase tracking-[0.12em] text-foreground transition-colors hover:border-accent/60 hover:text-accent"
          >
            ▶ Watch trailer
          </a>
        )}

        {meta.offers.length > 0 && (
          <div className="mt-6 flex flex-wrap justify-center gap-1.5">
            {meta.offers.map((o) => (
              <a
                key={`${o.provider}-${o.type}-${o.url}`}
                href={o.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-edge px-3 py-1 text-[11px] uppercase tracking-[0.12em] text-foreground transition-colors hover:border-accent/60 hover:text-accent"
              >
                {o.provider} · {o.type.toLowerCase()}
              </a>
            ))}
          </div>
        )}

        <div className="mt-8">
          {signedIn ? (
            <ResetSpinButton movieTitle={movieTitle} />
          ) : (
            <SignInPrompt
              message="Resetting the week's pick requires signing in. Sign in and you can return this movie to the pool or watch the trailer above."
              label="Sign in to unlock this week"
              callbackUrl="/wheel"
            />
          )}
        </div>
      </div>
    </div>
  );
}