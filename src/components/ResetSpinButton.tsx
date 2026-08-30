"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ResetSpinButton({ movieTitle }: { movieTitle: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reset() {
    if (busy) return;
    const confirmed = window.confirm(
      `Reset this week's spin?\n\n"${movieTitle}" will be returned to the pool so you can spin again. This deletes any ratings on this week's pick.`,
    );
    if (!confirmed) return;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/select", { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not reset the week.");
        return;
      }
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={reset}
        disabled={busy}
        className="rounded-full border border-edge px-5 py-2.5 text-sm font-medium text-muted transition-colors hover:border-accent/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? "Resetting…" : "Reset this week's spin"}
      </button>
      {error && <p className="mt-2 text-sm text-foreground/80">{error}</p>}
    </div>
  );
}
