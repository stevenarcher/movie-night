import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

/** Returns the signed-in session user or redirects to "/". */
export async function requireUser() {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) redirect("/");
  return user;
}

/** Returns the session user, or null when signed out (pages behind a sign-in gate). */
export async function currentUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user;
}