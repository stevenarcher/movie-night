import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import type { UserRole } from "@prisma/client";

const ADMIN_ROLE: UserRole = "ADMIN";

export async function isAdmin(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  return user?.role === ADMIN_ROLE;
}

export async function requireAdmin() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/");
  const admin = await isAdmin(session.user.id);
  if (!admin) redirect("/");
  return session.user;
}