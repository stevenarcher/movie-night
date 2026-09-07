"use client";

/**
 * Sign-out without pulling in next-auth/react. Same rationale as SignInButton:
 * the react client's `signOut` bundles a context provider and hooks that
 * anonymous visitors don't need. This reimplements the CSRF + POST protocol.
 */
export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={async () => {
        const csrfRes = await fetch("/api/auth/csrf");
        const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };
        const callbackUrl = "/";
        const res = await fetch("/api/auth/signout", {
          method: "post",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "X-Auth-Return-Redirect": "1",
          },
          body: new URLSearchParams({ csrfToken, callbackUrl }),
        });
        const data = (await res.json()) as { url?: string };
        window.location.href = data.url ?? callbackUrl;
      }}
      className="text-[11px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-accent"
    >
      Sign out
    </button>
  );
}