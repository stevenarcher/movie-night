"use client";

type Props = {
  /** 0–5. Interactive rating. */
  value?: number;
  onChange?: (value: number) => void;
  /** Fractional display for averages (ignored when interactive). */
  displayValue?: number | null;
  interactive?: boolean;
};

export function StarRating({ value = 0, onChange, displayValue, interactive = false }: Props) {
  if (!interactive) {
    const pct = displayValue == null ? 0 : Math.max(0, Math.min(1, displayValue / 5)) * 100;
    return (
      <span className="relative inline-block leading-none text-bone-dim" aria-label={`${displayValue ?? "–"} out of 5`}>
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

  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="Rate this movie">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} star${star === 1 ? "" : "s"}`}
          onClick={() => onChange?.(star)}
          className={`text-xl transition-transform hover:scale-125 ${
            star <= value ? "text-accent" : "text-bone-dim hover:text-accent/60"
          }`}
        >
          ★
        </button>
      ))}
    </div>
  );
}