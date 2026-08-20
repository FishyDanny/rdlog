import { describe, expect, test } from "vitest";
import { anchorHashToCalendars, verifyEntryHash, type HashableEntry } from "./timestamps";

const HASH = "1f5e3f51643f4f5d3aa8c5e194f02dd40a423fffa483608fc7ef699f1322762c";

describe("browser OpenTimestamps anchoring", () => {
  test("submits the SHA-256 digest to two calendars and retains each exact response", async () => {
    const requests: Array<{ body: Uint8Array; headers: Headers; url: string }> = [];
    const fetcher = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      requests.push({
        body: new Uint8Array(init?.body as ArrayBuffer),
        headers: new Headers(init?.headers),
        url: String(input),
      });
      const suffix = requests.length === 1 ? new Uint8Array([0, 1, 2]) : new Uint8Array([3, 4, 5]);
      return new Response(suffix, { status: 200 });
    };

    const anchors = await anchorHashToCalendars(HASH, fetcher);

    expect(requests).toHaveLength(2);
    expect(requests.map((request) => request.url)).toEqual([
      "https://a.pool.opentimestamps.org/digest",
      "https://b.pool.opentimestamps.org/digest",
    ]);
    expect(requests[0]?.headers.get("accept")).toBe("application/vnd.opentimestamps.v1");
    expect(requests[0]?.headers.get("content-type")).toBe("application/x-www-form-urlencoded");
    expect(requests[0]?.body).toHaveLength(32);
    expect(anchors).toEqual([
      { calendarUrl: "https://a.pool.opentimestamps.org", receipt: "AAEC", status: "pending" },
      { calendarUrl: "https://b.pool.opentimestamps.org", receipt: "AwQF", status: "pending" },
    ]);
  });

  test("fails the operation unless two distinct receipts are captured", async () => {
    const fetcher = async (input: RequestInfo | URL): Promise<Response> => String(input).includes("a.pool")
      ? new Response(new Uint8Array([0, 1, 2]), { status: 200 })
      : new Response("calendar unavailable", { status: 503 });

    await expect(anchorHashToCalendars(HASH, fetcher)).rejects.toThrow("two OpenTimestamps calendars");
  });

  test("recomputes the server canonical hash before sending it to calendars", async () => {
    const entry: HashableEntry = {
      body: "Moving hot keys into a compact index will reduce p95 read latency by at least 15%.",
      createdAt: "2026-08-16T01:02:03.000Z",
      experimentId: "id-3",
      hash: "pending",
      kind: "hypothesis",
      occurredAt: "2026-08-16T01:00:00.000Z",
      previousHash: null,
      sequence: 1,
    };
    entry.hash = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(JSON.stringify([
        "rdlog-entry-v1",
        entry.experimentId,
        entry.kind,
        entry.body,
        entry.occurredAt,
        entry.createdAt,
        entry.previousHash,
        entry.sequence,
      ])),
    ).then((digest) => [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join(""));

    await expect(verifyEntryHash(entry)).resolves.toBe(true);
    await expect(verifyEntryHash({ ...entry, body: `${entry.body} changed` })).resolves.toBe(false);
  });
});
