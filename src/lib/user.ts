import { prisma } from "@/lib/prisma";

export async function getUserById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, image: true },
  });
}

/**
 * Fetches a user's display data and admin flag in a single query. The Nav
 * needs both `name`/`image` (avatar) and `role` (admin check); combining them
 * avoids two separate round-trips to the same User row on every request.
 */
export async function getUserNav(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, image: true, role: true },
  });
  if (!user) return null;
  return {
    name: user.name,
    image: user.image,
    isAdmin: user.role === "ADMIN",
  };
}