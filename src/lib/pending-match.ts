import { prisma } from "@/lib/prisma";
import type { User } from "@prisma/client";

/**
 * Whether a PENDING placeholder identity matches a Google login's first name.
 * Both sides are lowercased/trimmed; matches on equality OR when either is a
 * prefix of the other ("Dip" ↔ "Dipesh", "Kev" ↔ "Kevin").
 */
export function matchesPendingName(placeholder: string, firstName: string): boolean {
  const a = placeholder.trim().toLowerCase();
  const b = firstName.trim().toLowerCase();
  if (!a || !b) return false;
  return a === b || a.startsWith(b) || b.startsWith(a);
}

/**
 * Pick the best PENDING placeholder for a Google first name. Prefers an exact
 * match, then the longest prefix match — "Ben" beats "Benny" for a "Benjamin"
 * login — and falls back to declaration order so the result is deterministic.
 */
export function matchPendingUser(pendingUsers: User[], firstName: string): User | null {
  const candidates = pendingUsers.filter(
    (u) => u.role === "PENDING" && u.name && matchesPendingName(u.name, firstName),
  );
  if (candidates.length === 0) return null;
  const exact = candidates.find((u) => u.name!.toLowerCase() === firstName.toLowerCase());
  if (exact) return exact;
  return candidates.sort((a, b) => (b.name?.length ?? 0) - (a.name?.length ?? 0))[0];
}

/** Fetch PENDING placeholders and claim the one matching a Google first name, if any. */
export async function findPendingForLogin(name: string | null | undefined): Promise<User | null> {
  if (!name) return null;
  const firstName = name.trim().split(/\s+/)[0];
  if (!firstName) return null;
  const pending = await prisma.user.findMany({ where: { role: "PENDING" } });
  return matchPendingUser(pending, firstName);
}