import { formatDistanceToNowStrict, format, parseISO } from "date-fns";
import { de } from "date-fns/locale";

export function formatNumber(n: number | string | null | undefined, digits = 0): string {
  if (n === null || n === undefined || n === "") return "—";
  const num = typeof n === "string" ? Number(n) : n;
  if (!Number.isFinite(num)) return "—";
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(num);
}

export function formatMoneyFromMicros(micros: string | number | null | undefined): string {
  if (micros === null || micros === undefined) return "—";
  const m = typeof micros === "string" ? Number(micros) : micros;
  if (!Number.isFinite(m)) return "—";
  const euros = m / 1_000_000;
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(euros);
}

export function formatPercent(num: number | null | undefined, digits = 1): string {
  if (num === null || num === undefined) return "—";
  if (!Number.isFinite(num)) return "—";
  return `${(num * 100).toFixed(digits)}%`;
}

export function formatDelta(num: number | null | undefined, digits = 0): string {
  if (num === null || num === undefined || !Number.isFinite(num)) return "";
  const sign = num > 0 ? "+" : "";
  return `${sign}${(num * 100).toFixed(digits)}%`;
}

export function formatDate(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? parseISO(iso) : iso;
  return format(d, "dd.MM.yyyy", { locale: de });
}

export function formatDateTime(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? parseISO(iso) : iso;
  return format(d, "dd.MM.yyyy HH:mm", { locale: de });
}

export function formatRelative(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? parseISO(iso) : iso;
  try {
    return formatDistanceToNowStrict(d, { addSuffix: true, locale: de });
  } catch {
    return "—";
  }
}

export function truncateId(id: string, head = 8): string {
  if (id.length <= head + 3) return id;
  const parts = id.split("_");
  if (parts.length === 2) {
    return `${parts[0]}_${parts[1].slice(0, head)}…`;
  }
  return `${id.slice(0, head)}…`;
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function todayEnd(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}
