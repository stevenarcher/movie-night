import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { badRequest, ok, unauthorized } from "@/lib/api";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) return unauthorized();

  const { id } = await context.params;
  if (!id) return badRequest("Missing candidate id");

  try {
    await prisma.candidate.delete({ where: { id } });
    return ok({ ok: true });
  } catch {
    return badRequest("Candidate not found or already removed");
  }
}