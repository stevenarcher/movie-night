import { currentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { currentWeek } from "@/lib/week";
import { movieMeta, type MovieMeta } from "@/lib/movie-meta";
import { ChooseClient } from "@/components/ChooseClient";
import { ResetPickButton } from "@/components/ResetPickButton";
import { SignInPrompt } from "@/components/SignInPrompt";

export const dynamic = "force-dynamic";

export default async function ChoosePage() {
  const user = await currentUser();
  const signedIn = Boolean(user);

  const week = currentWeek();
  const [candidates, locked] = await Promise.all([
    prisma.candidate.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.screening.findUnique({
      where: { year_weekNumber: { year: week.year, weekNumber: week.weekNumber } },
      select: {
        movieTitle: true,
        weekNumber: true,
        metadata: true,
        selectionMethod: true,
        selectedBy: { select: { name: true } },
      },
    }),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <div className="mb-12 text-center">
        <p className="eyebrow-accent mb-4">WK {week.weekNumber} · {week.year}</p>
        <h1 className="font-display text-5xl tracking-tight sm:text-6xl">Choose this week&apos;s movie</h1>
        <p className="mt-5 mx-auto max-w-md text-muted">
          Spin the wheel, vote, or just pick one. Whichever you choose, the movie is locked for the week.
        </p>
      </div>

      {locked ? (
        <LockedPanel
          signedIn={signedIn}
          movieTitle={locked.movieTitle}
          weekNumber={locked.weekNumber}
          meta={movieMeta(locked.metadata)}
          selectionMethod={locked.selectionMethod}
          selectedByName={locked.selectedBy?.name ?? null}
        />
      ) : (
        <ChooseClient
          signedIn={signedIn}
          candidates={candidates.map((c) => {
            const meta = movieMeta(c.metadata);
            return {
              id: c.id,
              title: c.title,
              posterUrl: meta.posterUrl,
              offers: meta.offers,
            };
          })}
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
  selectionMethod,
  selectedByName,
}: {
  signedIn: boolean;
  movieTitle: string;
  weekNumber: number;
  meta: MovieMeta;
  selectionMethod: string;
  selectedByName: string | null;
}) {
  const initials = selectedByName
    ? selectedByName
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : null;

  const methodLabel =
    selectionMethod === "SPIN"
      ? "Spun"
      : selectionMethod === "VOTE"
        ? "Voted"
        : "Picked";

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

        {initials && (
          <p className="mt-3 text-sm text-muted">
            {methodLabel} by{" "}
            <span className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-accent/15 px-1.5 text-[11px] font-semibold text-accent">
              {initials}
            </span>
          </p>
        )}

        <p className="mt-3 text-sm text-muted">
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
            <ResetPickButton movieTitle={movieTitle} />
          ) : (
            <SignInPrompt
              message="Resetting this week's pick requires signing in."
              label="Sign in to unlock this week"
              callbackUrl="/choose"
            />
          )}
        </div>
      </div>
    </div>
  );
}
