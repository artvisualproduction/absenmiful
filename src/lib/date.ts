export const ASIA_JAKARTA_TZ = 'Asia/Jakarta';

const DAY_NAME_TO_ISO: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

export const INDONESIAN_DAY_NAMES: Record<number, string> = {
  1: 'Senin',
  2: 'Selasa',
  3: 'Rabu',
  4: 'Kamis',
  5: 'Jumat',
  6: 'Sabtu',
  7: 'Minggu',
};

function toDate(value: Date | string | number): Date {
  return value instanceof Date ? value : new Date(value);
}

/** Returns YYYY-MM-DD in Asia/Jakarta timezone */
export function getDateKeyJakarta(input: Date | string | number = new Date()): string {
  const date = toDate(input);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: ASIA_JAKARTA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const month = parts.find((p) => p.type === 'month')?.value ?? '01';
  const day = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
}

/** Returns HH:mm in Asia/Jakarta timezone (24-hour format) */
export function getTimeHHMMJakarta(input: Date | string | number = new Date()): string {
  const date = toDate(input);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: ASIA_JAKARTA_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const hour = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const minute = parts.find((p) => p.type === 'minute')?.value ?? '00';
  return `${hour === '24' ? '00' : hour}:${minute}`;
}

/** Returns 1 (Senin) through 7 (Minggu) in Asia/Jakarta timezone */
export function getDayOfWeekJakarta(input: Date | string | number = new Date()): number {
  const date = toDate(input);
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: ASIA_JAKARTA_TZ,
    weekday: 'short',
  }).format(date);
  return DAY_NAME_TO_ISO[weekday] ?? 1;
}

/** Formats readable Indonesian date in Asia/Jakarta, e.g. "Kamis, 19 November 2026" */
export function formatDateLongJakarta(input: Date | string | number = new Date()): string {
  const date = toDate(input);
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: ASIA_JAKARTA_TZ,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

/** Formats short Indonesian date in Asia/Jakarta, e.g. "19 Nov 2026" */
export function formatDateShortJakarta(input: Date | string | number = new Date()): string {
  const date = toDate(input);
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: ASIA_JAKARTA_TZ,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

/** Formats HH:mm:ss in 24-hour format */
export function formatTimeWithSecondsJakarta(input: Date | string | number = new Date()): string {
  const date = toDate(input);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: ASIA_JAKARTA_TZ,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const hour = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const minute = parts.find((p) => p.type === 'minute')?.value ?? '00';
  const second = parts.find((p) => p.type === 'second')?.value ?? '00';
  return `${hour === '24' ? '00' : hour}:${minute}:${second}`;
}

/** Formats date and 24-hour time, e.g. "19 Nov 2026, 07:05" */
export function formatDateTimeJakarta(input: Date | string | number = new Date()): string {
  return `${formatDateShortJakarta(input)}, ${getTimeHHMMJakarta(input)}`;
}

/** Converts HH:mm string to total minutes from midnight (0..1439) */
export function parseTimeToMinutes(hhmm: string): number {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm.trim());
  if (!match) {
    throw new Error(`Format waktu tidak valid: "${hhmm}". Gunakan format HH:mm.`);
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

/** Checks whether current HH:mm falls inclusively inside [startHHMM, endHHMM] */
export function isTimeWithinWindow(
  currentHHMM: string,
  startHHMM: string,
  endHHMM: string,
): boolean {
  const current = parseTimeToMinutes(currentHHMM);
  const start = parseTimeToMinutes(startHHMM);
  const end = parseTimeToMinutes(endHHMM);
  return current >= start && current <= end;
}
