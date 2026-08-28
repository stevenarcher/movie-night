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

export const Wheel = forwardRef<WheelHandle, { titles: string[] }>(function Wheel(
  { titles },
  ref,
) {
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const promiseRef = useRef<{ resolve: () => void } | null>(null);
  const timedOutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const total = titles.length;
  const sweep = total > 0 ? 360 / total : 360;
  const minRevolutions = 5;

  const slices = useMemo(() => {
    return titles.map((title, i) => {
      const startDeg = -90 + i * sweep;
      const midDeg = startDeg + sweep / 2;
      return { title, midDeg, path: slicePath(CX, CY, R, startDeg, startDeg + sweep) };
    });
  }, [titles, sweep]);

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

  return (
    <div className="relative mx-auto h-[400px] w-[400px] select-none sm:h-[460px] sm:w-[460px]">
      <svg viewBox="0 0 400 400" className="h-full w-full drop-shadow-[0_20px_50px_rgba(0,0,0,0.55)]">
        <g
          style={{
            transform: `rotate(${rotation}deg)`,
            transformOrigin: "200px 200px",
            transition: spinning
              ? `transform ${SPIN_DURATION_MS}ms cubic-bezier(0.12, 0.8, 0.15, 1)`
              : "none",
          }}
          onTransitionEnd={() => {
            if (timedOutRef.current) {
              finish();
            }
          }}
        >
          {slices.map((s, i) => (
            <g key={`${s.title}-${i}`}>
              <path d={s.path} fill={PALETTE[i % PALETTE.length]} stroke="#0b0f1a" strokeWidth="2" />
              {total <= 28 && <Label midDeg={s.midDeg} title={s.title} />}
            </g>
          ))}
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
  );
});

function Label({ midDeg, title }: { midDeg: number; title: string }) {
  const normalized = ((midDeg % 360) + 360) % 360;
  const flipped = normalized > 180;
  const labelR = 132;
  const x = CX + (flipped ? -labelR : labelR);
  const rot = flipped ? midDeg + 180 : midDeg;

  return (
    <text
      x={x}
      y={CY}
      textAnchor={flipped ? "end" : "start"}
      dominantBaseline="middle"
      transform={`rotate(${rot} ${CX} ${CY})`}
      fontSize="15"
      fontWeight="600"
      fill="#0b0f1a"
      className="pointer-events-none"
    >
      {title.length > 18 ? `${title.slice(0, 17)}…` : title}
    </text>
  );
}