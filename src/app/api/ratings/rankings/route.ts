import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ok, unauthorized } from "@/lib/api";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return unauthorized();

  const grouped = await prisma.rating.groupBy({
    by: ["screeningId"],
    _avg: { value: true },
    _count: { value: true },
  });

  const screeningIds = grouped.map((g) => g.screeningId);
  const screenings = screeningIds.length
    ? await prisma.screening.findMany({
        where: { id: { in: screeningIds } },
        select: { id: true, movieTitle: true },
      })
    : [];

  const byScreening = new Map(screenings.map((s) => [s.id, s]));

  const byTitle = new Map<string, { name: string; average: number; count: number }>();

  for (const row of grouped) {
    const screening = byScreening.get(row.screeningId);
    if (!screening || row._avg.value === null) continue;
    const avg = Math.round((row._avg.value ?? 0) * 100) / 100;
    const count = row._count.value ?? 0;

    const key = screening.movieTitle.toLowerCase();
    const existing = byTitle.get(key);
    if (existing) {
      const totalWeighted = existing.average * existing.count + avg * count;
      const newCount = existing.count + count;
      byTitle.set(key, {
        name: screening.movieTitle,
        average: Math.round((totalWeighted / newCount) * 100) / 100,
        count: newCount,
      });
    } else {
      byTitle.set(key, { name: screening.movieTitle, average: avg, count });
    }
  }

  const rows = [...byTitle.values()].sort(
    (a, b) => b.average - a.average || b.count - a.count,
  );

  return ok({
    top: rows.slice(0, 5),
    bottom: [...rows].reverse().slice(0, 5),
    all: rows,
  });
}