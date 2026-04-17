"use client";

import { useEffect, useState } from "react";
import { formatRelative, formatDateTime } from "@/lib/format";

export function RelativeTime({
  date,
  className,
}: {
  date: string | Date | null | undefined;
  className?: string;
}) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(interval);
  }, []);

  if (!date) return <span className={className}>—</span>;

  return (
    <span className={className} title={formatDateTime(date)}>
      {formatRelative(date)}
    </span>
  );
}
