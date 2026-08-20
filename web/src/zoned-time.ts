const MINUTE_MS = 60 * 1_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

export interface ResolvedWallClock {
  instant: string;
  offsetMinutes: number;
}

function currentTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function readParts(date: Date, timeZone: string): Record<Intl.DateTimeFormatPartTypes, string> {
  const parts = new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(date);
  const read = {} as Record<Intl.DateTimeFormatPartTypes, string>;
  for (const part of parts) {
    read[part.type] = part.value;
  }
  return read;
}

/**
 * Minutes east of UTC that the zone was actually observing at the given instant.
 * This reads the offset from the zone database rather than from the host clock,
 * so it stays correct on either side of a daylight saving transition.
 */
export function offsetMinutesAt(instant: number, timeZone: string = currentTimeZone()): number {
  const parts = readParts(new Date(instant), timeZone);
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  );
  return Math.round((asUtc - instant) / MINUTE_MS);
}

export function toDatetimeLocal(date: Date, timeZone: string = currentTimeZone()): string {
  const parts = readParts(date, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour === "24" ? "00" : parts.hour}:${parts.minute}`;
}

/**
 * Turns a `datetime-local` wall clock into an exact instant plus the offset that
 * was applied. A bare wall clock is not a point in time: at the end of daylight
 * saving the same reading happens twice, and at the start it never happens at
 * all. Ambiguous readings resolve to the earlier instant and readings inside the
 * gap move forward by the length of the gap, so the stored instant never drifts
 * by an hour from what the recorder saw on the clock.
 */
export function resolveWallClock(local: string, timeZone: string = currentTimeZone()): ResolvedWallClock {
  const naive = Date.parse(`${local.length === 16 ? `${local}:00` : local}Z`);
  if (Number.isNaN(naive)) {
    throw new Error("Enter the time the work occurred as a valid date and time.");
  }
  const before = offsetMinutesAt(naive - DAY_MS, timeZone);
  const after = offsetMinutesAt(naive + DAY_MS, timeZone);
  const candidates = [...new Set([naive - before * MINUTE_MS, naive - after * MINUTE_MS])]
    .filter((candidate) => offsetMinutesAt(candidate, timeZone) * MINUTE_MS === naive - candidate)
    .sort((left, right) => left - right);
  const instant = candidates[0] ?? naive - before * MINUTE_MS;
  return { instant: new Date(instant).toISOString(), offsetMinutes: offsetMinutesAt(instant, timeZone) };
}

export function formatOffset(offsetMinutes: number): string {
  const sign = offsetMinutes < 0 ? "-" : "+";
  const absolute = Math.abs(offsetMinutes);
  return `UTC${sign}${String(Math.floor(absolute / 60)).padStart(2, "0")}:${String(absolute % 60).padStart(2, "0")}`;
}

/**
 * Renders an instant in the offset it was recorded under, so a reader in another
 * zone still sees the wall clock the recorder wrote down. Entries stored before
 * offsets were captured fall back to the reader's own zone, labelled as such.
 */
export function formatRecordedTime(instant: string, offsetMinutes: number | null | undefined): string {
  const date = new Date(instant);
  if (Number.isNaN(date.getTime())) {
    return instant;
  }
  if (offsetMinutes === null || offsetMinutes === undefined || !Number.isFinite(offsetMinutes)) {
    return `${formatInViewerZone(date)} (your time zone)`;
  }
  const shifted = new Date(date.getTime() + offsetMinutes * MINUTE_MS);
  const formatted = new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(shifted);
  return `${formatted} (${formatOffset(offsetMinutes)})`;
}

export function formatInViewerZone(date: Date): string {
  return new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
