const KATHMANDU_TZ = 'Asia/Kathmandu';

export function getKathmanduDateParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: KATHMANDU_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) {
    map[p.type] = p.value;
  }
  const hour = Number(map.hour === '24' ? '0' : map.hour);
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour,
    minute: Number(map.minute),
    second: Number(map.second),
    isoDate: `${map.year}-${map.month}-${map.day}`,
    isoMonth: `${map.year}-${map.month}`,
  };
}

export function getTodayISO(): string {
  return getKathmanduDateParts().isoDate;
}

export function getCurrentMonthISO(): string {
  return getKathmanduDateParts().isoMonth;
}

export function getDynamicGreeting(name = 'Shaurav'): string {
  const { hour } = getKathmanduDateParts();
  if (hour >= 5 && hour < 12) return `Good morning, ${name}`;
  if (hour >= 12 && hour < 17) return `Good afternoon, ${name}`;
  return `Good evening, ${name}`;
}

export function formatKathmanduDate(date = new Date()): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: KATHMANDU_TZ,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

export function formatKathmanduTime(date = new Date()): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: KATHMANDU_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

export function formatNPR(amount: number, showDecimals = false): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const formatted = new Intl.NumberFormat('en-NP', {
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  }).format(Math.abs(safe));
  return `${safe < 0 ? '-' : ''}NPR ${formatted}`;
}

export function formatShortDate(isoDate: string): string {
  if (!isoDate) return '—';
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return isoDate;
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function daysUntil(isoDate: string): number {
  const today = getTodayISO();
  const [y1, m1, d1] = today.split('-').map(Number);
  const [y2, m2, d2] = isoDate.split('-').map(Number);
  const t1 = Date.UTC(y1, m1 - 1, d1);
  const t2 = Date.UTC(y2, m2 - 1, d2);
  return Math.round((t2 - t1) / (1000 * 60 * 60 * 24));
}

export function addDaysISO(isoDate: string, delta: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  const yr = dt.getUTCFullYear();
  const mo = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dy = String(dt.getUTCDate()).padStart(2, '0');
  return `${yr}-${mo}-${dy}`;
}

export function computeStreaks(activeDatesInput: Iterable<string>): {
  currentStreak: number;
  bestStreak: number;
} {
  const uniqueSorted = Array.from(new Set(activeDatesInput)).filter(Boolean).sort();
  if (uniqueSorted.length === 0) return { currentStreak: 0, bestStreak: 0 };

  let bestStreak = 1;
  let running = 1;
  for (let i = 1; i < uniqueSorted.length; i++) {
    const prevNext = addDaysISO(uniqueSorted[i - 1], 1);
    if (prevNext === uniqueSorted[i]) {
      running++;
      if (running > bestStreak) bestStreak = running;
    } else {
      running = 1;
    }
  }

  const today = getTodayISO();
  const yesterday = addDaysISO(today, -1);
  const dateSet = new Set(uniqueSorted);

  let currentStreak = 0;
  let cursor = dateSet.has(today) ? today : dateSet.has(yesterday) ? yesterday : '';
  while (cursor && dateSet.has(cursor)) {
    currentStreak++;
    cursor = addDaysISO(cursor, -1);
  }

  return { currentStreak, bestStreak };
}

export function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) {
    return `${hrs}h ${mins}m`;
  }
  if (mins > 0) {
    return `${mins}m ${secs > 0 ? `${secs}s` : ''}`.trim();
  }
  return `${secs}s`;
}

export function formatStopwatch(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const centis = Math.floor((ms % 1000) / 10);
  const hStr = hours > 0 ? `${String(hours).padStart(2, '0')}:` : '';
  return `${hStr}${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centis).padStart(2, '0')}`;
}
