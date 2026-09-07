import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

const ADMIN_GOOGLE_ID = process.env.ADMIN_GOOGLE_ID;

export async function isAdmin(userId: string): Promise<boolean> {
  if (!ADMIN_GOOGLE_ID) return false;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { googleId: true },
  });
  return user?.googleId === ADMIN_GOOGLE_ID;
}

export async function requireAdmin() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/");
  const admin = await isAdmin(session.user.id);
  if (!admin) redirect("/");
  return session.user;
}
