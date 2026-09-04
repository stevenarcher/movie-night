import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/api";

/** Returns all vote counts for current pool candidates + the current user's votes. */
export async function GET() {
  const session = await auth();

  const [voteCounts, myVotes] = await Promise.all([
    prisma.vote.groupBy({
      by: ["candidateId"],
      _count: { id: true },
    }),
    session?.user?.id
      ? prisma.vote.findMany({
          where: { userId: session.user.id },
          select: { candidateId: true },
        })
      : [],
  ]);

  return ok({
    votes: voteCounts.map((v) => ({ candidateId: v.candidateId, count: v._count.id })),
    myVotes,
  });
}
