"use client";

import { useState, type CSSProperties } from "react";

type Props = {
  /** 0–5. Currently saved interactive rating. */
  value?: number;
  displayValue?: number | null;
  /** Called when the user saves a new rating. */
  onSubmit?: (value: number) => void;
  /** Shows a saving state on the submit button. */
  pending?: boolean;
  interactive?: boolean;
};

const STEP = 0.25;
const MAX = 5;

function roundQuarter(v: number): number {
  const r = Math.round(v / STEP) * STEP;
  return Math.min(MAX, Math.max(0, r));
}

// Paints the star glyph in accent up to `pct`% of its width, transparent after,
// by clipping a left-to-right gradient to the text shape. Pixel-aligned with the
// grey base because it runs on the same glyph, not a positioned copy.
function starFillStyle(pct: number): CSSProperties {
  return {
    backgroundImage: `linear-gradient(to right, var(--color-accent) ${pct}%, transparent ${pct}%)`,
    backgroundClip: "text",
    WebkitBackgroundClip: "text",
    color: "transparent",
    WebkitTextFillColor: "transparent",
  };
}

export function StarRating({
  value = 0,
  displayValue,
  onSubmit,
  pending = false,
  interactive = false,
}: Props) {
  const [draft, setDraft] = useState(roundQuarter(value));
  const [input, setInput] = useState(String(roundQuarter(value)));
  const [hover, setHover] = useState<number | null>(null);

  if (!interactive) {
    const pct = displayValue == null ? 0 : Math.max(0, Math.min(1, displayValue / 5)) * 100;
    return (
      <span
        className="relative inline-block leading-none text-bone-dim"
        aria-label={`${displayValue ?? "–"} out of 5`}
      >
        {"★★★★★"}
        <span
          className="absolute inset-0 overflow-hidden whitespace-nowrap text-accent"
          style={{ width: `${pct}%` }}
          aria-hidden="true"
        >
          {"★★★★★"}
        </span>
      </span>
    );
  }

  const dirty = Math.abs(draft - value) >= 1e-9;
  const display = hover ?? draft;

  function valueForStar(n: number, clientX: number, rect: DOMRect): number {
    const ratio = (clientX - rect.left) / rect.width;
    const quartile = Math.max(0, Math.min(3, Math.floor(ratio * 4)));
    return roundQuarter((n - 1) + 0.25 * (quartile + 1));
  }

  function handleHover(n: number, e: React.MouseEvent) {
    const rect = e.currentTarget.getBoundingClientRect();
    setHover(valueForStar(n, e.clientX, rect));
  }

  function handleLeave() {
    setHover(null);
  }

  function selectInStar(n: number, e: React.MouseEvent) {
    const rect = e.currentTarget.getBoundingClientRect();
    const v = valueForStar(n, e.clientX, rect);
    setDraft(v);
    setInput(String(v));
  }

  function handleInputChange(raw: string) {
    setInput(raw);
    const parsed = Number(raw);
    if (!Number.isNaN(parsed)) setDraft(roundQuarter(parsed));
  }

  function commitInput() {
    const snapped = roundQuarter(Number(input) || 0);
    setDraft(snapped);
    setInput(String(snapped));
  }

  function submit() {
    if (!dirty) return;
    onSubmit?.(roundQuarter(draft));
  }

  return (
    <div className="flex items-center gap-2">
      <div
        className="flex items-center gap-0.5"
        role="radiogroup"
        aria-label="Rate this movie"
        onMouseLeave={handleLeave}
      >
        {[1, 2, 3, 4, 5].map((n) => {
          const fillPct = Math.max(0, Math.min(1, display - (n - 1))) * 100;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={n === Math.round(display)}
              aria-label={`${n} star${n === 1 ? "" : "s"}`}
              onClick={(e) => selectInStar(n, e)}
              onMouseMove={(e) => handleHover(n, e)}
              className="grid h-6 w-6 place-items-center text-xl leading-none transition-transform hover:scale-110"
            >
              <span
                aria-hidden="true"
                className="relative inline-block leading-none text-bone-dim"
              >
                ★
                <span
                  className="absolute inset-0 leading-none"
                  style={starFillStyle(fillPct)}
                >
                  ★
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-1.5">
        <input
          type="number"
          value={input}
          min={0}
          max={MAX}
          step={STEP}
          onChange={(e) => handleInputChange(e.target.value)}
          onBlur={commitInput}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              commitInput();
              submit();
            }
          }}
          aria-label="Rating value"
          className="w-16 rounded-md border border-edge bg-panel-2 px-2 py-1 text-center font-mono text-sm text-foreground outline-none focus:border-accent"
        />
        {dirty && (
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className="rounded-md border border-accent bg-accent px-2.5 py-1 text-xs font-medium text-background transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "Saving…" : "Submit"}
          </button>
        )}
      </div>
    </div>
  );
}
