"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/" })}
      className="text-[11px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-accent"
    >
      Sign out
    </button>
  );
}