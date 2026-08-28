"use client";

import { useCallback, useState } from "react";

type Candidate = {
  id: string;
  title: string;
  source: "WHATSAPP" | "MANUAL";
  createdAt: string;
};

export function PoolClient({
  canSimulate,
  initialCandidates,
}: {
  canSimulate: boolean;
  initialCandidates: Candidate[];
}) {
  const [candidates, setCandidates] = useState<Candidate[]>(initialCandidates);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [injecting, setInjecting] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/pool");
    if (res.ok) {
      const data = await res.json();
      setCandidates(data.candidates);
    }
  }, []);

  async function addMovie(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = title.trim();
    if (!trimmed) return;

    const res = await fetch("/api/pool", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: trimmed }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Could not add that movie");
      return;
    }

    setTitle("");
    refresh();
  }

  async function removeMovie(id: string) {
    const res = await fetch(`/api/pool/${id}`, { method: "DELETE" });
    if (res.ok) refresh();
    else {
      const data = await res.json();
      setError(data.error ?? "Could not remove movie");
    }
  }

  async function injectWhatsAppMessage() {
    setInjecting(true);
    setError(null);
    const payload = {
      entry: [
        {
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                contacts: [
                  { profile: { name: "Dana (test)" }, wa_id: "15550000001" },
                ],
                messages: [
                  {
                    from: "15550000001",
                    id: `wamid.test.${Date.now()}`,
                    timestamp: String(Math.floor(Date.now() / 1000)),
                    type: "text",
                    group_id: process.env.NEXT_PUBLIC_WHATSAPP_GROUP_ID ?? "1203630test",
                    text: { body: title || "Inception" },
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    const res = await fetch("/api/whatsapp/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setInjecting(false);

    if (!res.ok) {
      setError(data.error ?? "Simulation failed");
    } else {
      setError(null);
      setTitle("");
      refresh();
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={addMovie}
        className="flex flex-col gap-3 rounded-2xl border border-edge bg-panel p-4 sm:flex-row"
      >
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Suggest a movie title…"
          maxLength={80}
          className="min-w-0 flex-1 rounded-xl border border-edge bg-background px-4 py-2.5 text-sm outline-none focus:border-accent/60 focus:ring-2 focus:ring-accent/20"
        />
        <div className="flex gap-2">
          <button
            type="submit"
            className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent/90 transition-colors"
          >
            Add to pool
          </button>
          {canSimulate && (
            <button
              type="button"
              onClick={injectWhatsAppMessage}
              disabled={injecting}
              className="rounded-xl border border-edge px-3 py-2.5 text-sm font-medium text-muted hover:text-foreground hover:border-foreground/30 transition-colors disabled:opacity-50"
              title="Dev only: pushes a fake WhatsApp group message through the real ingest pipeline"
            >
              {injecting ? "Injecting…" : "😷 Inject test WhatsApp msg"}
            </button>
          )}
        </div>
      </form>

      {error && (
        <p className="rounded-xl border border-accent/30 bg-accent/10 px-4 py-2 text-sm text-accent-2">
          {error}
        </p>
      )}

      {candidates.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-edge bg-panel-2 p-10 text-center text-muted">
          <p className="text-3xl">🍿</p>
          <p className="mt-2">No movies in the pool yet.</p>
          <p className="text-sm">Add one above, or wire up the WhatsApp webhook.</p>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-edge overflow-hidden rounded-2xl border border-edge bg-panel">
          {candidates.map((c, i) => (
            <li key={c.id} className="flex items-center gap-3 px-4 py-3">
              <span className="w-7 shrink-0 font-mono text-xs text-muted">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{c.title}</p>
                <p className="text-xs text-muted">
                  {c.source === "WHATSAPP" ? "via WhatsApp" : "manual"} ·{" "}
                  {new Date(c.createdAt).toLocaleDateString()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => removeMovie(c.id)}
                className="rounded-lg px-2 py-1 text-sm text-muted hover:bg-white/5 hover:text-foreground transition-colors"
                title="Remove from pool"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}