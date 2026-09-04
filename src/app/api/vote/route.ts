import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ok, badRequest, unauthorized } from "@/lib/api";

/** Cast or change a vote for a candidate in the current pool. */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return unauthorized();

  const body = await req.json().catch(() => null);
  const candidateId = body?.candidateId;
  if (typeof candidateId !== "string" || !candidateId) {
    return badRequest("candidateId is required");
  }

  const candidate = await prisma.candidate.findUnique({ where: { id: candidateId } });
  if (!candidate) {
    return badRequest("Candidate not found in the pool");
  }

  const vote = await prisma.vote.upsert({
    where: { userId_candidateId: { userId: session.user.id, candidateId } },
    update: {},
    create: { userId: session.user.id, candidateId },
  });

  // Count total votes for this candidate.
  const count = await prisma.vote.count({ where: { candidateId } });

  return ok({ voteId: vote.id, candidateId, count });
}

/** Remove the current user's vote(s). */
export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return unauthorized();

  const url = new URL(req.url);
  const candidateId = url.searchParams.get("candidateId");

  if (candidateId) {
    await prisma.vote.deleteMany({
      where: { userId: session.user.id, candidateId },
    });
  } else {
    // Remove all votes for this user (e.g. on reset).
    await prisma.vote.deleteMany({
      where: { userId: session.user.id },
    });
  }

  return ok({ deleted: true });
}
