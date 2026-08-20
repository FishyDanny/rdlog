export interface HashableEntry {
  body: string;
  createdAt: string;
  experimentId: string;
  hash: string;
  kind: string;
  occurredAt: string;
  occurredAtOffsetMinutes?: number | null;
  previousHash: string | null;
  sequence: number;
}

export interface CalendarAnchor {
  calendarUrl: string;
  receipt: string;
  status: "pending";
}

export type TimestampFetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const CALENDARS = [
  "https://a.pool.opentimestamps.org",
  "https://b.pool.opentimestamps.org",
] as const;

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(value: string): Uint8Array {
  if (!/^[a-f0-9]{64}$/u.test(value)) {
    throw new Error("The entry hash must be a 64-character SHA-256 digest.");
  }
  return new Uint8Array(value.match(/.{2}/gu)?.map((pair) => Number.parseInt(pair, 16)) ?? []);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToHex(new Uint8Array(digest));
}

/**
 * Mirrors canonicalEntryHash in the API byte for byte. Entries without a
 * recorded offset predate the daylight saving fix and keep the v1 preimage.
 */
export async function verifyEntryHash(entry: HashableEntry): Promise<boolean> {
  const offsetMinutes = entry.occurredAtOffsetMinutes ?? null;
  const expected = await sha256(JSON.stringify(offsetMinutes === null
    ? [
        "rdlog-entry-v1",
        entry.experimentId,
        entry.kind,
        entry.body,
        entry.occurredAt,
        entry.createdAt,
        entry.previousHash,
        entry.sequence,
      ]
    : [
        "rdlog-entry-v2",
        entry.experimentId,
        entry.kind,
        entry.body,
        entry.occurredAt,
        offsetMinutes,
        entry.createdAt,
        entry.previousHash,
        entry.sequence,
      ]));
  return expected === entry.hash;
}

async function submitToCalendar(
  hashBytes: Uint8Array,
  calendarUrl: string,
  fetcher: TimestampFetcher,
): Promise<CalendarAnchor> {
  const response = await fetcher(`${calendarUrl}/digest`, {
    body: new Uint8Array(hashBytes).buffer,
    headers: {
      accept: "application/vnd.opentimestamps.v1",
      "content-type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(`${calendarUrl} returned HTTP ${response.status}.`);
  }
  const receipt = new Uint8Array(await response.arrayBuffer());
  if (receipt.length === 0 || receipt.length > 10_000) {
    throw new Error(`${calendarUrl} returned an invalid receipt size.`);
  }
  return { calendarUrl, receipt: bytesToBase64(receipt), status: "pending" };
}

export async function anchorHashToCalendars(
  hash: string,
  fetcher: TimestampFetcher = fetch,
): Promise<CalendarAnchor[]> {
  const digest = hexToBytes(hash);
  const results = await Promise.allSettled(
    CALENDARS.map((calendar) => submitToCalendar(digest, calendar, fetcher)),
  );
  const anchors = results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
  if (anchors.length !== 2) {
    throw new Error("The entry could not be anchored to two OpenTimestamps calendars. Retry without changing the entry.");
  }
  return anchors;
}
