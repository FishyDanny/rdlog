import { describe, expect, test } from "vitest";
import { groupExperimentRows, type D1ExperimentRow } from "./d1-store";

const base: D1ExperimentRow = {
  amendmentBody: null,
  amendmentCreatedAt: null,
  amendmentHash: null,
  amendmentId: null,
  anchorAnchoredAt: null,
  anchorCalendarUrl: null,
  anchorId: null,
  anchorReceipt: null,
  anchorStatus: null,
  closedAt: null,
  entryBody: "The candidate returned p95 84 ms.",
  entryCreatedAt: "2026-08-16T01:02:03.000Z",
  entryHash: "a".repeat(64),
  entryId: "entry-1",
  entryKind: "observation",
  entryOccurredAt: "2026-08-16T01:00:00.000Z",
  entryPreviousHash: null,
  entrySequence: 1,
  experimentId: "experiment-1",
  objective: "Measure the candidate cache layout.",
  openedAt: "2026-08-16T00:00:00.000Z",
  status: "open",
  title: "Cache layout",
  workspaceId: "workspace-1",
};

describe("D1 rdlog row mapping", () => {
  test("deduplicates entry data across amendment and anchor join rows", () => {
    const rows: D1ExperimentRow[] = [
      {
        ...base,
        amendmentBody: "Correction: the run contained 55,000 requests.",
        amendmentCreatedAt: "2026-08-16T01:04:00.000Z",
        amendmentHash: "b".repeat(64),
        amendmentId: "amendment-1",
        anchorAnchoredAt: "2026-08-16T01:03:00.000Z",
        anchorCalendarUrl: "https://a.pool.opentimestamps.org",
        anchorId: "anchor-a",
        anchorReceipt: "AAEC",
        anchorStatus: "pending",
      },
      {
        ...base,
        amendmentBody: "Correction: the run contained 55,000 requests.",
        amendmentCreatedAt: "2026-08-16T01:04:00.000Z",
        amendmentHash: "b".repeat(64),
        amendmentId: "amendment-1",
        anchorAnchoredAt: "2026-08-16T01:03:00.000Z",
        anchorCalendarUrl: "https://b.pool.opentimestamps.org",
        anchorId: "anchor-b",
        anchorReceipt: "AwQF",
        anchorStatus: "pending",
      },
    ];

    const result = groupExperimentRows(rows);

    expect(result).toHaveLength(1);
    expect(result[0]?.entries).toHaveLength(1);
    expect(result[0]?.entries[0]?.amendments).toHaveLength(1);
    expect(result[0]?.entries[0]?.anchors.map((anchor) => anchor.id)).toEqual(["anchor-a", "anchor-b"]);
  });

  test("keeps a newly-created experiment with no entries", () => {
    const result = groupExperimentRows([{
      ...base,
      entryBody: null,
      entryCreatedAt: null,
      entryHash: null,
      entryId: null,
      entryKind: null,
      entryOccurredAt: null,
      entryPreviousHash: null,
      entrySequence: null,
    }]);

    expect(result[0]?.entries).toEqual([]);
  });
});
