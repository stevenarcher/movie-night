"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/" })}
      className="text-sm text-muted hover:text-foreground transition-colors"
    >
      Sign out
    </button>
  );
}