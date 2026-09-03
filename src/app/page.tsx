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
        where: { year_weekNumber: { year: week.year, weekNumber: week.weekNumber } },
        select: { movieTitle: true, weekNumber: true },
      }),
    ]);
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col items-center px-4 py-24 sm:py-32">
      <p className="eyebrow mb-6">Very Critical</p>

      <h1 className="font-display text-center text-6xl leading-[0.95] tracking-tight sm:text-8xl">
        Movie Night<span className="text-accent">.</span>
      </h1>

      <p className="mt-8 max-w-xl text-center text-lg leading-relaxed text-bone-dim">
        Friends suggest movies in WhatsApp, the wheel spins, and the group watches.
        Past picks live in the archive, rated by everyone.
      </p>

      {session?.user?.id ? (
        <StatusPanel
          poolCount={poolCount}
          currentScreening={currentScreening}
        />
      ) : (
        <div className="mt-12">
          <SignInButton label="Start Movie Night with Google" />
        </div>
      )}

      <section className="mt-24 grid w-full gap-px overflow-hidden rounded-2xl border border-edge bg-edge sm:grid-cols-3">
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
    <div className="bg-panel p-6">
      <div className="flex items-center gap-3">
        <span className="font-mono text-xs tracking-[0.2em] text-accent">{number}.</span>
      </div>
      <h2 className="font-display mt-3 text-2xl">{title}</h2>
      <p className="mt-3 text-sm leading-relaxed text-muted">{children}</p>
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
    <div className="mt-12 flex w-full max-w-xl flex-col items-center gap-6 rounded-xl border border-edge bg-panel px-8 py-8 text-center">
      {currentScreening ? (
        <>
          <div className="slate w-full">
            <span className="sc">TAKE 01</span>
            <span className="nm">locked</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <p className="eyebrow">Week {currentScreening.weekNumber} is locked in</p>
            <p className="font-display text-3xl">{currentScreening.movieTitle}</p>
          </div>
          <div className="flex gap-3">
            <Link href="/archive" className="rounded-full border border-edge px-5 py-2.5 text-[11px] uppercase tracking-[0.2em] text-foreground transition-colors hover:border-accent/60 hover:text-accent">
              View archive
            </Link>
            <Link href="/pool" className="rounded-full border border-edge px-5 py-2.5 text-[11px] uppercase tracking-[0.2em] text-foreground transition-colors hover:border-accent/60 hover:text-accent">
              Suggest for next week
            </Link>
          </div>
        </>
      ) : (
        <>
          <div className="slate w-full">
            <span className="sc">TAKE 01</span>
            <span className="nm">ready to roll</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <p className="eyebrow">
              {poolCount} movie{poolCount === 1 ? " is" : "s are"} ready to spin
            </p>
            <p className="text-sm text-muted">The next selection has not been made yet.</p>
          </div>
          <Link
            href="/wheel"
            className="rounded-full bg-accent px-8 py-3 text-sm font-medium text-background shadow-[0_0_30px_rgba(2,223,130,0.35)] transition-colors hover:bg-accent-2"
          >
            Spin the wheel →
          </Link>
        </>
      )}
    </div>
  );
}