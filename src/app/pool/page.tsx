import { currentUser } from "@/lib/session";
import { getCandidates } from "@/lib/queries";
import { PoolClient } from "@/components/PoolClient";

export const dynamic = "force-dynamic";

export default async function PoolPage() {
  const user = await currentUser();
  const candidates = await getCandidates();

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
        signedIn={Boolean(user)}
        canSimulate={process.env.NODE_ENV !== "production"}
        initialCandidates={candidates}
      />
    </div>
  );
}