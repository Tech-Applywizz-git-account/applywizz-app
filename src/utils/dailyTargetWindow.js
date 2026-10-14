/** IST window helpers for overnight daily-target Live Activity (8:00 PM → 5:00 AM). */

const IST = "Asia/Kolkata";

function partsInIst(now = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: IST,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const bag = {};
  for (const p of fmt.formatToParts(now)) {
    if (p.type !== "literal") bag[p.type] = p.value;
  }
  return {
    year: Number(bag.year),
    month: Number(bag.month),
    day: Number(bag.day),
    hour: Number(bag.hour),
    minute: Number(bag.minute),
  };
}

/** True from 20:00 inclusive through 04:59 (ends at 5:00 AM IST). */
export function isDailyTargetLiveWindow(now = new Date()) {
  const { hour } = partsInIst(now);
  return hour >= 20 || hour < 5;
}

/** Human clock in IST, e.g. "10:26 PM". */
export function formatIstClock(now = new Date()) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: IST,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(now);
}

/**
 * Minutes from window start (20:00 IST) and until end (05:00 IST).
 * Window length = 9 hours = 540 minutes.
 */
export function liveWindowMinutes(now = new Date()) {
  if (!isDailyTargetLiveWindow(now)) {
    return { elapsed: 0, remaining: 0, total: 540, fraction: 0 };
  }
  const { hour, minute } = partsInIst(now);
  const total = 9 * 60;
  let elapsed;
  if (hour >= 20) {
    elapsed = (hour - 20) * 60 + minute;
  } else {
    // after midnight: 20:00→00:00 = 240m, then + current
    elapsed = 4 * 60 + hour * 60 + minute;
  }
  elapsed = Math.min(total, Math.max(0, elapsed));
  const remaining = Math.max(0, total - elapsed);
  return {
    elapsed,
    remaining,
    total,
    fraction: elapsed / total,
  };
}

export function minutesUntilLiveWindowEnd(now = new Date()) {
  return liveWindowMinutes(now).remaining;
}

/** Fraction of the 8PM→5AM window elapsed (0–1). */
export function liveWindowElapsedFraction(now = new Date()) {
  return liveWindowMinutes(now).fraction;
}

export function formatUsdShort(n) {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1000) {
    const k = v / 1000;
    return `$${k.toFixed(k >= 10 ? 0 : 1)}k`;
  }
  return `$${Math.round(v)}`;
}

export function formatMinutesShort(mins) {
  const m = Math.max(0, Math.round(mins || 0));
  if (m < 60) return `${m}m left`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h ${r}m left` : `${h}h left`;
}
