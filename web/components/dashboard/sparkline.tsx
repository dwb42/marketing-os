"use client";

import { cn } from "@/lib/utils";

/**
 * Lightweight inline SVG sparkline. No external deps.
 */
export function Sparkline({
  values,
  className,
  width = 120,
  height = 32,
  strokeWidth = 1.5,
}: {
  values: number[];
  className?: string;
  width?: number;
  height?: number;
  strokeWidth?: number;
}) {
  if (values.length === 0) {
    return (
      <div
        className="w-full h-full flex items-center text-[10px] text-muted-foreground/70"
      >
        —
      </div>
    );
  }

  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const n = values.length;

  const points = values
    .map((v, i) => {
      const x = n === 1 ? width / 2 : (i / (n - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  // area path
  const area = `M0,${height} L${points.split(" ").join(" L")} L${width},${height} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={cn("w-full h-full", className)}
    >
      <path d={area} fill="currentColor" fillOpacity="0.08" />
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
