import { describe, expect, test } from "vitest";
import { experimentIdFromPath, getRouteMetadata, serialisePack, toDatetimeLocal } from "./App";
import type { SubstantiationPack } from "./api";

describe("rdlog routing and export helpers", () => {
  test("recognises only a complete experiment route", () => {
    expect(experimentIdFromPath("/experiments/experiment-1")).toBe("experiment-1");
    expect(experimentIdFromPath("/experiments/experiment%202")).toBe("experiment 2");
    expect(experimentIdFromPath("/experiments/")).toBeNull();
    expect(experimentIdFromPath("/privacy")).toBeNull();
  });

  test("uses distinct metadata for the workspace and experiment record", () => {
    expect(getRouteMetadata(null, null)).toEqual({
      description: "Record R&D experiments as they happen, hash-link every entry and export exact OpenTimestamps calendar receipts.",
      robots: "index, follow",
      title: "Rdlog — contemporaneous R&D experiment records",
    });
    expect(getRouteMetadata("experiment-1", "Cache layout")).toEqual({
      description: "Private hash-linked experiment record in Rdlog.",
      robots: "noindex, nofollow",
      title: "Cache layout — private Rdlog experiment",
    });
  });

  test("formats a local entry time and produces a stable export download", () => {
    expect(toDatetimeLocal(new Date("2026-08-16T01:02:03.000Z"), "UTC")).toBe("2026-08-16T01:02");
    const pack: SubstantiationPack = {
      disclaimer: "Record-keeping only.",
      experiment: {
        closedAt: null,
        entries: [],
        id: "experiment-1",
        objective: "Measure the cache layout.",
        openedAt: "2026-08-16T01:00:00.000Z",
        status: "open",
        title: "Cache layout",
        workspaceId: "workspace-1",
      },
      exportedAt: "2026-08-16T01:05:00.000Z",
      hashChainValid: true,
      primarySources: [],
      receiptNote: "Pending.",
      schemaVersion: "rdlog-export-v1",
    };

    expect(serialisePack(pack)).toEqual({
      contents: JSON.stringify(pack, null, 2),
      filename: "rdlog-experiment-1-2026-08-16.json",
    });
  });
});
