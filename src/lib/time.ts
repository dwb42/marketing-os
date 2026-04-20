// Alle Server-Zeitstempel sind UTC. Pro Workspace gibt es eine Timezone
// nur für Darstellung und Datumsfenster (z.B. "Kanalmetriken von gestern").

export function nowUtc(): Date {
  return new Date();
}

export function startOfUtcDay(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

export function yesterdayUtc(): Date {
  const d = startOfUtcDay(nowUtc());
  d.setUTCDate(d.getUTCDate() - 1);
  return d;
}

export function daysAgoUtc(n: number): Date {
  const d = startOfUtcDay(nowUtc());
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}
