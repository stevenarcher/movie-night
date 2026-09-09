import { cache } from "react";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

/**
 * Request-scoped auth memoization. With the database session strategy every
 * `auth()` call is a Session-table lookup; `React.cache` dedupes them so the
 * Nav header and the page share a single lookup per request instead of two.
 */
export const getSession = cache(() => auth());

/** Returns the signed-in session user or redirects to "/". */
export async function requireUser() {
  const session = await getSession();
  const user = session?.user;
  if (!user?.id) redirect("/");
  return user;
}

/** Returns the session user, or null when signed out (pages behind a sign-in gate). */
export async function currentUser() {
  const session = await getSession();
  if (!session?.user?.id) return null;
  return session.user;
}