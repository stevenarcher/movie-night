"use client";

import { useCallback, useState } from "react";

type Offer = {
  type: "RENT" | "BUY" | "STREAM" | "FREE";
  provider: string;
  price: number | null;
  url: string;
};

type Candidate = {
  id: string;
  title: string;
  source: "WHATSAPP" | "MANUAL";
  createdAt: string;
  posterUrl: string | null;
  offers: Offer[];
};

function formatPrice(price: number | null): string {
  if (price === null) return "Included";
  if (price === 0) return "Free";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(price);
}

const TYPE_LABEL: Record<Offer["type"], string> = {
  RENT: "Rent",
  BUY: "Buy",
  STREAM: "Stream",
  FREE: "Free",
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
        className="flex flex-col gap-3 rounded-xl border border-edge bg-panel p-4 sm:flex-row"
      >
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Suggest a movie title…"
          maxLength={80}
          className="min-w-0 flex-1 rounded-lg border border-edge bg-background px-4 py-2.5 text-sm font-light outline-none focus:border-accent/60 focus:ring-2 focus:ring-accent/20 placeholder:text-bone-dim"
        />
        <div className="flex gap-2">
          <button
            type="submit"
            className="rounded-lg bg-accent px-5 py-2.5 text-[11px] font-medium uppercase tracking-[0.2em] text-background hover:bg-accent-2 transition-colors"
          >
            Add to pool
          </button>
          {canSimulate && (
            <button
              type="button"
              onClick={injectWhatsAppMessage}
              disabled={injecting}
              className="rounded-lg border border-edge px-3 py-2.5 text-[11px] uppercase tracking-[0.2em] text-muted transition-colors hover:border-accent/60 hover:text-accent disabled:opacity-50"
              title="Dev only: pushes a fake WhatsApp group message through the real ingest pipeline"
            >
              {injecting ? "Injecting" : "😷 Inject test msg"}
            </button>
          )}
        </div>
      </form>

      {error && (
        <p className="rounded-lg border border-accent/30 bg-accent/10 px-4 py-2 text-sm text-accent-2">
          {error}
        </p>
      )}

      {candidates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-edge bg-panel-2 p-14 text-center text-muted">
          <p className="font-display text-3xl italic">Dead reel</p>
          <p className="mt-2 text-sm">No movies in the pool yet.</p>
          <p className="text-sm">Add one above, or wire up the WhatsApp webhook.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {candidates.map((c) => (
            <li
              key={c.id}
              className="flex gap-4 rounded-xl border border-edge bg-panel p-4"
            >
              {c.posterUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={c.posterUrl}
                  alt={`${c.title} poster`}
                  loading="lazy"
                  className="h-[128px] w-[85px] shrink-0 self-start rounded-md border border-edge object-cover"
                />
              )}

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-display truncate text-xl">{c.title}</p>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted">
                      {c.source === "WHATSAPP" ? "via WhatsApp" : "manual"} ·{" "}
                      {new Date(c.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeMovie(c.id)}
                    className="rounded-md px-2 py-1 text-sm text-muted transition-colors hover:bg-white/5 hover:text-accent"
                    title="Remove from pool"
                  >
                    ✕
                  </button>
                </div>

                {c.offers.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {c.offers.map((o) => (
                      <a
                        key={`${o.provider}-${o.type}`}
                        href={o.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full border border-edge px-2.5 py-1 text-xs text-muted transition-colors hover:border-accent/60 hover:text-foreground"
                      >
                        <span className="rounded bg-panel-2 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-accent">
                          {TYPE_LABEL[o.type] ?? o.type}
                        </span>
                        <span>{o.provider}</span>
                        <span className="text-foreground">{formatPrice(o.price)}</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}