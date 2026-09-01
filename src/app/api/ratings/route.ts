import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { badRequest, ok, serverError, unauthorized } from "@/lib/api";

const ratingSchema = z.object({
  screeningId: z.string().min(1),
  value: z
    .number()
    .min(0)
    .max(5)
    .refine((v) => Math.abs(v * 4 - Math.round(v * 4)) < 1e-9, {
      message: "rating must be a multiple of 0.25",
    }),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return unauthorized();

  let parsed: z.infer<typeof ratingSchema>;
  try {
    parsed = ratingSchema.parse(await request.json());
  } catch {
    return badRequest("`screeningId` and a `value` between 0 and 5 in 0.25 increments are required");
  }

  const screening = await prisma.screening.findUnique({
    where: { id: parsed.screeningId },
  });
  if (!screening) {
    return badRequest("That screening does not exist");
  }

  try {
    const rating = await prisma.rating.upsert({
      where: {
        userId_screeningId: { userId: session.user.id, screeningId: parsed.screeningId },
      },
      update: { value: parsed.value },
      create: { userId: session.user.id, screeningId: parsed.screeningId, value: parsed.value },
    });
    return ok({ rating });
  } catch (error) {
    console.error("[ratings] upsert failed", error);
    return serverError("Failed to save rating");
  }
}