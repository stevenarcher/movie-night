import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { movieMeta } from "@/lib/movie-meta";
import { PoolClient } from "@/components/PoolClient";

export const dynamic = "force-dynamic";

export default async function PoolPage() {
  await requireUser();

  const candidates = await prisma.candidate.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <div className="mb-10">
        <p className="eyebrow-accent mb-4">CANDIDATES · AWAITING PICTURE</p>
        <h1 className="font-display text-5xl tracking-tight sm:text-6xl">The pool</h1>
        <p className="mt-5 max-w-xl text-muted">
          Everything queued up for coming weeks. Suggestions from WhatsApp land here
          automatically; add movies manually below if the group chat&apos;s feeling quiet.
        </p>
      </div>

      <PoolClient
        canSimulate={process.env.NODE_ENV !== "production"}
        initialCandidates={candidates.map((c) => {
          const meta = movieMeta(c.metadata);
          return {
            id: c.id,
            title: c.title,
            source: c.source,
            createdAt: c.createdAt.toISOString(),
            posterUrl: meta.posterUrl,
            trailerUrl: meta.trailerUrl,
            offers: meta.offers,
          };
        })}
      />
    </div>
  );
}