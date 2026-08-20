import { describe, expect, test } from "vitest";
import {
  appendAmendment,
  appendEntry,
  createExperiment,
  ensureWorkspace,
  getExperiment,
  listExperiments,
  readExport,
  saveAnchors,
  type BrowserStorage,
  type Fetcher,
} from "./api";

describe("rdlog web API client", () => {
  test("stores the browser workspace and sends its token through the complete experiment journey", async () => {
    const values = new Map<string, string>();
    const storage: BrowserStorage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    };
    const requests: Array<{ body: unknown; method: string; token: string | null; url: string }> = [];
    const fetcher: Fetcher = async (url, init) => {
      const body = typeof init?.body === "string" ? JSON.parse(init.body) as unknown : null;
      requests.push({
        body,
        method: init?.method ?? "GET",
        token: new Headers(init?.headers).get("authorization"),
        url,
      });
      if (url.endsWith("/api/workspace")) {
        return Response.json({ token: "signed-workspace-token" }, { status: 201 });
      }
      if (url.endsWith("/api/experiments") && init?.method === "POST") {
        return Response.json({
          closedAt: null,
          entries: [],
          id: "experiment-1",
          objective: "Measure the candidate cache layout.",
          openedAt: "2026-08-16T01:00:00.000Z",
          status: "open",
          title: "Cache layout",
          workspaceId: "workspace-1",
        }, { status: 201 });
      }
      if (url.endsWith("/entries") && init?.method === "POST") {
        return Response.json({
          body: "Candidate returned p95 84 ms.",
          createdAt: "2026-08-16T01:02:03.000Z",
          experimentId: "experiment-1",
          hash: "a".repeat(64),
          id: "entry-1",
          kind: "observation",
          occurredAt: "2026-08-16T01:01:00.000Z",
          occurredAtOffsetMinutes: 600,
          previousHash: null,
          sequence: 1,
        }, { status: 201 });
      }
      if (url.endsWith("/anchors")) {
        const submitted = body && typeof body === "object" && "anchors" in body && Array.isArray(body.anchors)
          ? body.anchors as Array<{ calendarUrl: string; receipt: string; status: "pending" }>
          : [];
        return Response.json({
          anchors: submitted.map((anchor, index) => ({
            ...anchor,
            anchoredAt: "2026-08-16T01:03:00.000Z",
            entryId: "entry-1",
            id: `anchor-${index + 1}`,
          })),
        }, { status: 201 });
      }
      if (url.endsWith("/amendments")) {
        return Response.json({
          body: "Correction: 55,000 requests.",
          createdAt: "2026-08-16T01:04:00.000Z",
          entryId: "entry-1",
          hash: "b".repeat(64),
          id: "amendment-1",
        }, { status: 201 });
      }
      if (url.endsWith("/export")) {
        return Response.json({
          disclaimer: "Record-keeping only; not tax advice and does not prove eligibility.",
          experiment: {
            closedAt: null,
            entries: [],
            id: "experiment-1",
            objective: "Measure.",
            openedAt: "2026-08-16T01:00:00.000Z",
            status: "open",
            title: "Cache layout",
            workspaceId: "workspace-1",
          },
          exportedAt: "2026-08-16T01:05:00.000Z",
          hashChainValid: true,
          primarySources: [],
          receiptNote: "Pending commitments.",
          schemaVersion: "rdlog-export-v1",
        });
      }
      if (url.endsWith("/api/experiments/experiment-1")) {
        return Response.json({
          closedAt: null,
          entries: [],
          id: "experiment-1",
          objective: "Measure.",
          openedAt: "2026-08-16T01:00:00.000Z",
          status: "open",
          title: "Cache layout",
          workspaceId: "workspace-1",
        });
      }
      return Response.json({ experiments: [] });
    };

    const token = await ensureWorkspace(storage, fetcher, "https://api.example.com");
    await listExperiments(fetcher, "https://api.example.com", token);
    const experiment = await createExperiment(fetcher, "https://api.example.com", token, {
      objective: "Measure the candidate cache layout.",
      title: "Cache layout",
    });
    await getExperiment(fetcher, "https://api.example.com", token, experiment.id);
    const entry = await appendEntry(fetcher, "https://api.example.com", token, experiment.id, {
      body: "Candidate returned p95 84 ms.",
      kind: "observation",
      occurredAt: "2026-08-16T01:01:00.000Z",
      occurredAtOffsetMinutes: 600,
    });
    await saveAnchors(fetcher, "https://api.example.com", token, entry.id, [
      { calendarUrl: "https://a.pool.opentimestamps.org", receipt: "AAEC", status: "pending" },
      { calendarUrl: "https://b.pool.opentimestamps.org", receipt: "AwQF", status: "pending" },
    ]);
    await appendAmendment(fetcher, "https://api.example.com", token, entry.id, "Correction: 55,000 requests.");
    const pack = await readExport(fetcher, "https://api.example.com", token, experiment.id);

    expect(values.get("s72-rdlog-workspace")).toBe("signed-workspace-token");
    expect(pack.hashChainValid).toBe(true);
    expect(requests).toHaveLength(8);
    expect(requests.slice(1).every((request) => request.token === "Bearer signed-workspace-token")).toBe(true);
    expect(requests.map((request) => request.url)).toEqual([
      "https://api.example.com/api/workspace",
      "https://api.example.com/api/experiments",
      "https://api.example.com/api/experiments",
      "https://api.example.com/api/experiments/experiment-1",
      "https://api.example.com/api/experiments/experiment-1/entries",
      "https://api.example.com/api/entries/entry-1/anchors",
      "https://api.example.com/api/entries/entry-1/amendments",
      "https://api.example.com/api/experiments/experiment-1/export",
    ]);
  });

  test("surfaces API error messages", async () => {
    const fetcher: Fetcher = async () => Response.json({ error: "Experiment not found in this workspace." }, { status: 404 });
    await expect(getExperiment(fetcher, "https://api.example.com", "token", "missing"))
      .rejects.toThrow("Experiment not found in this workspace.");
  });
});
