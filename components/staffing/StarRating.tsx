"use client";

import { useId } from "react";

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

const STAR_PATH = "M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z";

/** Renders 0–5 stars with half-star steps (e.g. 2.5 → two full + one half). */
export function StarRating({ rating, size = 18 }: { rating: number; size?: number }) {
  const uid = useId().replace(/:/g, "");
  const r = clamp(Number(rating) || 0, 0, 5);
  const stars: Array<"full" | "half" | "empty"> = [];
  let remaining = r;
  for (let i = 0; i < 5; i++) {
    if (remaining >= 1) {
      stars.push("full");
      remaining -= 1;
    } else if (remaining >= 0.5) {
      stars.push("half");
      remaining = 0;
    } else {
      stars.push("empty");
    }
  }

  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`Rating ${r} out of 5`}>
      {stars.map((kind, i) => {
        const clipId = `${uid}-half-${i}`;
        return (
          <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
            <svg width={size} height={size} viewBox="0 0 24 24" className="text-gray-200">
              <path fill="currentColor" d={STAR_PATH} />
            </svg>
            {kind === "full" ? (
              <svg
                width={size}
                height={size}
                viewBox="0 0 24 24"
                className="absolute inset-0 text-amber-400 drop-shadow-sm"
              >
                <path fill="currentColor" d={STAR_PATH} />
              </svg>
            ) : kind === "half" ? (
              <svg
                width={size}
                height={size}
                viewBox="0 0 24 24"
                className="absolute inset-0 text-amber-400 drop-shadow-sm"
              >
                <defs>
                  <clipPath id={clipId}>
                    <rect x="0" y="0" width="12" height="24" />
                  </clipPath>
                </defs>
                <path fill="currentColor" d={STAR_PATH} clipPath={`url(#${clipId})`} />
              </svg>
            ) : null}
          </span>
        );
      })}
    </span>
  );
}
