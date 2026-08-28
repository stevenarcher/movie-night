import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PoolClient } from "@/components/PoolClient";

export const dynamic = "force-dynamic";

export default async function PoolPage() {
  await requireUser();

  const candidates = await prisma.candidate.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">The pool</h1>
        <p className="mt-2 text-muted">
          Everything queued up for coming weeks. Suggestions from WhatsApp land here
          automatically; add movies manually below if the group chat&apos;s feeling quiet.
        </p>
      </div>

      <PoolClient
        canSimulate={process.env.NODE_ENV !== "production"}
        initialCandidates={candidates.map((c) => ({
          id: c.id,
          title: c.title,
          source: c.source,
          createdAt: c.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}