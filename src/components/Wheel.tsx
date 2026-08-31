"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";

const CX = 200;
const CY = 200;
const R = 190;

const WHEEL_EASING = cubicBezier(0.12, 0.8, 0.15, 1);

/* Numeric solver for href-less cubic-bezier(x1,y1,x2,y2): maps progress x in [0,1]
   to eased output y. Used in the rAF spin loop so per-frame angle & velocity match
   the final segment landing exactly. */
function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const sampleX = (t: number) =>
    3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t;
  const sampleY = (t: number) =>
    3 * (1 - t) * (1 - t) * t * y1 + 3 * (1 - t) * t * t * y2 + t * t * t;
  const sampleDX = (t: number) =>
    3 * (1 - t) * (1 - t) * x1 + 6 * (1 - t) * t * (x2 - x1) + 3 * t * t * (1 - x2);
  return (x: number): number => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 12; i++) {
      const err = sampleX(t) - x;
      if (Math.abs(err) < 1e-6) break;
      const d = sampleDX(t);
      if (d === 0) break;
      t -= err / d;
    }
    return sampleY(t);
  };
}
const PALETTE = [
  "#4c6b84",
  "#2b9d8c",
  "#e6c15a",
  "#f4a261",
  "#e76f51",
  "#c23a55",
  "#86bc4d",
  "#a6d9b4",
  "#7a5c9e",
  "#e87aa6",
  "#3aa6b9",
  "#d6b73f",
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
  const [winnerIndex, setWinnerIndex] = useState<number | null>(null);
  const promiseRef = useRef<{ resolve: () => void } | null>(null);
  const timedOutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const winnerRef = useRef<number | null>(null);
  const pointerRef = useRef<SVGGElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastSliceRef = useRef<number>(-1);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (timedOutRef.current) clearTimeout(timedOutRef.current);
    };
  }, []);

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
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    lastSliceRef.current = -1;
    setWinnerIndex(winnerRef.current);
    res?.resolve();
  }

  /* One physical impulse: kick the pointer toward the oncoming segment edge
     (proportional to the wheel's current speed), then let it spring back. */
  function rattle(ampDeg: number) {
    const el = pointerRef.current;
    if (!el || ampDeg < 0.3) return;
    el.style.setProperty("--rattle-ang", `${ampDeg.toFixed(2)}deg`);
    el.classList.remove("pointer-rattle");
    void el.getBoundingClientRect();
    el.classList.add("pointer-rattle");
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

        setRotation(rotation);
        winnerRef.current = index;
        setWinnerIndex(null);

        return new Promise<void>((resolve) => {
          promiseRef.current = { resolve };
          timedOutRef.current = setTimeout(finish, SPIN_DURATION_MS + 500);

          // Reduced-motion users get an instant settle, no animation.
          if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            setRotation(nextRotation);
            finish();
            return;
          }

          const from = rotation;
          const delta = nextRotation - from;
          const start = performance.now();
          lastSliceRef.current = -1;
          let prevAngle = from;
          let prevTime = start;

          const frame = (now: number) => {
            const p = Math.min(1, (now - start) / SPIN_DURATION_MS);
            const eased = WHEEL_EASING(p);
            const angle = p >= 1 ? nextRotation : from + delta * eased;
            setRotation(angle);

            const dtSec = Math.max(0.001, (now - prevTime) / 1000);
            const velocity = (angle - prevAngle) / dtSec;
            prevAngle = angle;
            prevTime = now;

            // Current slice sitting under the fixed top pointer.
            const aTop = ((-90 - angle) % 360 + 360) % 360;
            const j = Math.floor((aTop + 90) / sweep) % total;
            if (j !== lastSliceRef.current && p > 0 && p < 1) {
              lastSliceRef.current = j;
              // Push the pointer at least 60° anticlockwise (the CSS keyframe negates this
              // positive magnitude), with a speed bonus — min 60°, cap at 84°.
              rattle(Math.min(84, 60 + Math.abs(velocity) / 600));
            }

            if (p < 1) {
              rafRef.current = requestAnimationFrame(frame);
            } else {
              finish();
            }
          };
          rafRef.current = requestAnimationFrame(frame);
        });
      },
    }),
    [slices, rotation, sweep, total],
  );

  const rotationStyle = {
    transform: `rotate(${rotation}deg)`,
    transformOrigin: "200px 200px",
    transition: "none",
  };

  return (
    <div className="relative mx-auto flex h-[400px] w-[400px] items-center justify-center select-none sm:h-[460px] sm:w-[460px]">
      {/* Viewfinder framing brackets */}
      <span className="vf-corner tl" aria-hidden="true" />
      <span className="vf-corner tr" aria-hidden="true" />
      <span className="vf-corner bl" aria-hidden="true" />
      <span className="vf-corner br" aria-hidden="true" />
      {/* Shared 400x400 coordinate box for the wedge fills and the SVG,
          scaled up together on sm so they never fall out of alignment. */}
      <div className="relative h-[400px] w-[400px] shrink-0 sm:scale-[1.15]">
        {/* Wedge colour layer — a solid palette colour fills each segment via the slice path. */}
        <div className="absolute inset-0" style={rotationStyle} aria-hidden="true">
          {slices.map((s, i) => (
            <div
              key={`wedge-${s.title}-${i}`}
              style={{
                position: "absolute",
                inset: 0,
                backgroundColor: PALETTE[i % PALETTE.length],
                clipPath: `path("${s.path}")`,
                pointerEvents: "none",
              }}
            />
          ))}
        </div>

        <svg viewBox="0 0 400 400" className="absolute inset-0 h-full w-full drop-shadow-[0_20px_50px_rgba(0,0,0,0.55)]">
          <g
            style={rotationStyle}
          >
            {slices.map((s, i) => (
              <path key={`${s.title}-${i}`} d={s.path} fill="none" stroke="#050706" strokeWidth="2" />
            ))}
            {total <= 28 &&
              slices.map((s, i) => (
                <Label
                  key={`label-${s.title}-${i}`}
                  midDeg={s.midDeg}
                  title={s.title}
                  winning={winnerIndex === i}
                />
              ))}
          </g>

          <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(237,241,236,0.22)" strokeWidth="6" />
          <circle cx={CX} cy={CY} r={R - 12} fill="none" stroke="rgba(237,241,236,0.1)" strokeWidth="1" />

          <circle cx={CX} cy={CY} r="46" fill="#0a0e0c" stroke="rgba(237,241,236,0.22)" strokeWidth="4" />
          <circle cx={CX} cy={CY} r="30" fill="#050706" stroke="rgba(237,241,236,0.14)" strokeWidth="1" />
          <text
            x={CX}
            y={CY + 1}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-accent"
            fontFamily="var(--font-instrument-serif), serif"
            fontStyle="italic"
            fontSize="30"
          >
            MN
          </text>

          <g ref={pointerRef}>
            <path d={`M ${CX - 16} 6 L ${CX + 16} 6 L ${CX} 42 Z`} fill="#02df82" />
            <circle cx={CX} cy={10} r="7" fill="#050706" stroke="#02df82" strokeWidth="3" />
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

function Label({ midDeg, title, winning }: { midDeg: number; title: string; winning?: boolean }) {
  const outerR = R - 14;
  const angleRad = ((midDeg - 90) * Math.PI) / 180;
  const px = CX + outerR * Math.cos(angleRad);
  const py = CY + outerR * Math.sin(angleRad);
  const tangentDeg = midDeg + 90;
  const lines = wrapTitle(title, 12);
  const lineHeight = 13;

  return (
    <g transform={`translate(${px} ${py}) rotate(${tangentDeg})`}>
      <g className={winning ? "winner-pop" : undefined}>
        {lines.map((line, i) => (
          <text
            key={i}
            x={0}
            y={lineHeight * (i - lines.length / 2) + lineHeight / 2}
            textAnchor="start"
            dominantBaseline="central"
            fontSize="11"
            fontWeight="700"
            fill={winning ? "#02df82" : "#050706"}
            className="pointer-events-none"
          >
            {line}
          </text>
        ))}
      </g>
    </g>
  );
}