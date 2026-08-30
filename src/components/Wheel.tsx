"use client";

import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from "react";

const CX = 200;
const CY = 200;
const R = 190;

const PALETTE = [
  "#f43f5e",
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
  "#6366f1",
  "#84cc16",
  "#06b6d4",
  "#d946ef",
];

function polar(cx: number, cy: number, r: number, angleDeg: number): [number, number] {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

function slicePath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const [x0, y0] = polar(cx, cy, r, endDeg);
  const [x1, y1] = polar(cx, cy, r, startDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${largeArc} 0 ${x1} ${y1} Z`;
}

export const SPIN_DURATION_MS = 4200;

export interface WheelHandle {
  /** Animates to the given slice index and resolves when the animation ends. */
  spinTo: (index: number) => Promise<void>;
}

export type WheelSegment = { title: string; posterUrl: string | null };

export const Wheel = forwardRef<WheelHandle, { segments: WheelSegment[] }>(function Wheel(
  { segments },
  ref,
) {
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const promiseRef = useRef<{ resolve: () => void } | null>(null);
  const timedOutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const total = segments.length;
  const sweep = total > 0 ? 360 / total : 360;
  const minRevolutions = 5;

  const slices = useMemo(() => {
    return segments.map((segment, i) => {
      const startDeg = -90 + i * sweep;
      const endDeg = startDeg + sweep;
      const midDeg = startDeg + sweep / 2;
      const path = slicePath(CX, CY, R, startDeg, endDeg);
      return { ...segment, midDeg, startDeg, endDeg, path };
    });
  }, [segments, sweep]);

  function finish() {
    const res = promiseRef.current;
    promiseRef.current = null;
    if (timedOutRef.current) {
      clearTimeout(timedOutRef.current);
      timedOutRef.current = null;
    }
    setSpinning(false);
    res?.resolve();
  }

  useImperativeHandle(
    ref,
    () => ({
      spinTo(index: number) {
        const target = slices[index];
        if (!target || promiseRef.current) return Promise.resolve();

        // Bring the target slice's centre to the top pointer (0°).
        const shift = ((-(target.midDeg % 360)) + 360) % 360;
        const base = ((rotation % 360) + 360) % 360;
        const advance = shift - base;
        const nextRotation = rotation + minRevolutions * 360 + (advance >= 0 ? advance : advance + 360);

        setSpinning(true);
        setRotation(nextRotation);

        return new Promise<void>((resolve) => {
          promiseRef.current = { resolve };
          // Safety net in case transitionend never fires.
          timedOutRef.current = setTimeout(finish, SPIN_DURATION_MS + 500);
        });
      },
    }),
    [slices, rotation],
  );

  const rotationStyle = {
    transform: `rotate(${rotation}deg)`,
    transformOrigin: "200px 200px",
    transition: spinning
      ? `transform ${SPIN_DURATION_MS}ms cubic-bezier(0.12, 0.8, 0.15, 1)`
      : "none",
  };

  return (
    <div className="relative mx-auto flex h-[400px] w-[400px] items-center justify-center select-none sm:h-[460px] sm:w-[460px]">
      {/* Shared 400x400 coordinate box for both the poster wedges and the SVG,
          scaled up together on sm so they never fall out of alignment. */}
      <div className="relative h-[400px] w-[400px] shrink-0 sm:scale-[1.15]">
        {/* Poster wedge layer — blurred poster (or palette) fills each segment via the slice path. */}
        <div className="absolute inset-0" style={rotationStyle} aria-hidden="true">
          {slices.map((s, i) => (
            <div
              key={`wedge-${s.title}-${i}`}
              style={{
                position: "absolute",
                inset: 0,
                backgroundColor: PALETTE[i % PALETTE.length],
                backgroundImage: s.posterUrl ? `url(${s.posterUrl})` : undefined,
                backgroundSize: "cover",
                backgroundPosition: "center",
                clipPath: `path("${s.path}")`,
                pointerEvents: "none",
              }}
            />
          ))}
        </div>

        <svg viewBox="0 0 400 400" className="absolute inset-0 h-full w-full drop-shadow-[0_20px_50px_rgba(0,0,0,0.55)]">
          <g
            style={rotationStyle}
            onTransitionEnd={() => {
              if (timedOutRef.current) {
                finish();
              }
            }}
          >
            {slices.map((s, i) => (
              <path key={`${s.title}-${i}`} d={s.path} fill="none" stroke="#0b0f1a" strokeWidth="2" />
            ))}
            {total <= 28 &&
              slices.map((s, i) => <Label key={`label-${s.title}-${i}`} midDeg={s.midDeg} title={s.title} />)}
          </g>

          <circle cx={CX} cy={CY} r={R} fill="none" stroke="#2b3a57" strokeWidth="6" />
          <circle cx={CX} cy={CY} r={R - 12} fill="none" stroke="rgba(0,0,0,0.28)" strokeWidth="1" />

          <circle cx={CX} cy={CY} r="46" fill="#121a2b" stroke="#2b3a57" strokeWidth="4" />
          <circle cx={CX} cy={CY} r="30" fill="#1c2740" />
          <text x={CX} y={CY + 2} textAnchor="middle" dominantBaseline="middle" className="fill-white" fontSize="26">
            🎬
          </text>

          <g>
            <path d={`M ${CX - 16} 6 L ${CX + 16} 6 L ${CX} 42 Z`} fill="#f43f5e" />
            <circle cx={CX} cy={10} r="7" fill="#0b0f1a" stroke="#f43f5e" strokeWidth="3" />
          </g>
        </svg>
      </div>
    </div>
  );
});

function wrapTitle(title: string, maxChars: number): string[] {
  const tokens: string[] = [];
  for (const t of title.split(" ").filter(Boolean)) {
    if (t.length <= maxChars) tokens.push(t);
    else {
      let rest = t;
      while (rest.length > maxChars) {
        tokens.push(rest.slice(0, maxChars));
        rest = rest.slice(maxChars);
      }
      tokens.push(rest);
    }
  }

  let line1 = "";
  let line2 = "";
  let overflow = false;
  for (const word of tokens) {
    const onto1 = line1 ? `${line1} ${word}` : word;
    if (onto1.length <= maxChars) {
      line1 = onto1;
      continue;
    }
    const onto2 = line2 ? `${line2} ${word}` : word;
    if (onto2.length <= maxChars) {
      line2 = onto2;
      continue;
    }
    overflow = true;
    break;
  }

  const result = line1 ? [line1] : [];
  if (line2) result.push(line2);
  if (overflow) {
    const lastIndex = result.length - 1;
    const last = lastIndex >= 0 ? result[lastIndex] : "";
    result[result.length] =
      last.length >= maxChars ? `${last.slice(0, maxChars - 1)}…` : last ? `${last}…` : "…";
  }
  return result.length ? result : [title.slice(0, maxChars - 1) + "…"];
}

function Label({ midDeg, title }: { midDeg: number; title: string }) {
  const outerR = R - 14;
  const angleRad = ((midDeg - 90) * Math.PI) / 180;
  const px = CX + outerR * Math.cos(angleRad);
  const py = CY + outerR * Math.sin(angleRad);
  const tangentDeg = midDeg + 90;
  const lines = wrapTitle(title, 12);
  const lineHeight = 13;
  const bodyH = lines.length * lineHeight;
  const padX = 6;
  const maxWidth = Math.max(...lines.map((l) => l.length)) * 5.8;

  return (
    <g transform={`translate(${px} ${py}) rotate(${tangentDeg})`}>
      <rect
        x={-padX}
        y={-bodyH / 2 - 5}
        width={maxWidth + padX * 2}
        height={bodyH + 10}
        rx={9}
        fill="white"
        opacity="0.95"
      />
      {lines.map((line, i) => (
        <text
          key={i}
          x={0}
          y={lineHeight * (i - lines.length / 2) + lineHeight / 2}
          textAnchor="start"
          dominantBaseline="central"
          fontSize="11"
          fontWeight="700"
          fill="#0b0f1a"
          className="pointer-events-none"
        >
          {line}
        </text>
      ))}
    </g>
  );
}