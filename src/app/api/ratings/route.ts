import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { badRequest, ok, serverError, unauthorized } from "@/lib/api";

const ratingSchema = z.object({
  screeningId: z.string().min(1),
  value: z.number().min(0).max(5).finite(),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return unauthorized();

  let parsed: z.infer<typeof ratingSchema>;
  try {
    parsed = ratingSchema.parse(await request.json());
  } catch {
    return badRequest("`screeningId` and a `value` between 0 and 5 (up to 2 decimal places) are required");
  }

  const screening = await prisma.screening.findUnique({
    where: { id: parsed.screeningId },
  });
  if (!screening) {
    return badRequest("That screening does not exist");
  }

  const value = Math.round(parsed.value * 100) / 100;

  try {
    const rating = await prisma.rating.upsert({
      where: {
        userId_screeningId: { userId: session.user.id, screeningId: parsed.screeningId },
      },
      update: { value },
      create: { userId: session.user.id, screeningId: parsed.screeningId, value },
    });
    return ok({ rating });
  } catch (error) {
    console.error("[ratings] upsert failed", error);
    return serverError("Failed to save rating");
  }
}