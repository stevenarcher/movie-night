import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { currentWeek } from "@/lib/week";
import { SignInButton } from "@/components/SignInButton";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await auth();

  let poolCount = 0;
  let currentScreening: { movieTitle: string; weekNumber: number } | null = null;

  if (session?.user?.id) {
    const week = currentWeek();
    [poolCount, currentScreening] = await Promise.all([
      prisma.candidate.count(),
      prisma.screening.findUnique({
        where: { weekNumber: week.weekNumber },
        select: { movieTitle: true, weekNumber: true },
      }),
    ]);
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col items-center px-4 py-20 sm:py-28">
      <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-edge bg-panel px-4 py-1.5 text-xs font-medium text-muted">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        A weekly movie pick, decided by nobody&apos;s argument but the wheel&apos;s
      </p>

      <h1 className="text-center text-5xl font-black tracking-tight sm:text-7xl">
        Movie Night
        <span className="text-accent">.</span>
      </h1>

      <p className="mt-6 max-w-xl text-center text-lg text-muted">
        Friends suggest movies in WhatsApp, the wheel spins, and the group watches.
        Past picks live in the archive, rated by everyone.
      </p>

      {session?.user?.id ? (
        <StatusPanel
          poolCount={poolCount}
          currentScreening={currentScreening}
        />
      ) : (
        <div className="mt-10">
          <SignInButton label="Start Movie Night with Google" />
        </div>
      )}

      <section className="mt-20 grid w-full gap-4 sm:grid-cols-3">
        <Feature number="01" title="WhatsApp suggestions">
          Anything sent in the group chat lands in the candidate pool — deduped and
          spam-filtered automatically.
        </Feature>
        <Feature number="02" title="Spin the wheel">
          Smooth animated wheel picks this week&apos;s movie. No arguments, no recriminations.
        </Feature>
        <Feature number="03" title="Archive &amp; ratings">
          Every pick is archived. Rate them 1–5 stars and see the group&apos;s verdict.
        </Feature>
      </section>
    </div>
  );
}

function Feature({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-edge bg-panel p-5">
      <p className="font-mono text-xs text-accent">{number}</p>
      <h2 className="mt-2 font-semibold">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">{children}</p>
    </div>
  );
}

function StatusPanel({
  poolCount,
  currentScreening,
}: {
  poolCount: number;
  currentScreening: { movieTitle: string; weekNumber: number } | null;
}) {
  return (
    <div className="mt-10 flex flex-col items-center gap-5 rounded-2xl border border-edge bg-panel px-8 py-6 text-center">
      {currentScreening ? (
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm text-muted">
            Week {currentScreening.weekNumber} is locked in —
          </p>
          <p className="text-2xl font-bold">🎬 {currentScreening.movieTitle}</p>
          <div className="flex gap-3">
            <Link href="/archive" className="rounded-full bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/15 transition-colors">
              View archive
            </Link>
            <Link href="/pool" className="rounded-full bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/15 transition-colors">
              Suggest for next week
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm text-muted">
            {poolCount} movie{poolCount === 1 ? " is" : "s are"} ready to spin.
            Next selection has not been made yet.
          </p>
          <Link
            href="/wheel"
            className="rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent/30 hover:bg-accent/90 transition-colors"
          >
            Spin the wheel →
          </Link>
        </div>
      )}
    </div>
  );
}