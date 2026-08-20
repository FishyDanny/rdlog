import { describe, expect, test } from "vitest";
import {
  canonicalEntryHash,
  createApi,
  type ExperimentView,
  type RdlogAmendment,
  type RdlogAnchor,
  type RdlogEntry,
  type RdlogExperiment,
  type RdlogStore,
  type RdlogWorkspace,
} from "./app";

class MemoryStore implements RdlogStore {
  readonly amendments: RdlogAmendment[] = [];
  readonly anchors: RdlogAnchor[] = [];
  readonly entries: RdlogEntry[] = [];
  readonly experiments: RdlogExperiment[] = [];
  readonly workspaces = new Map<string, RdlogWorkspace>();

  async appendAmendment(amendment: RdlogAmendment): Promise<void> {
    this.amendments.push(structuredClone(amendment));
  }

  async appendEntry(entry: RdlogEntry): Promise<void> {
    this.entries.push(structuredClone(entry));
  }

  async createExperiment(experiment: RdlogExperiment): Promise<void> {
    this.experiments.push(structuredClone(experiment));
  }

  async createWorkspace(workspace: RdlogWorkspace): Promise<void> {
    this.workspaces.set(workspace.id, structuredClone(workspace));
  }

  async getEntry(id: string): Promise<RdlogEntry | null> {
    return structuredClone(this.entries.find((entry) => entry.id === id) ?? null);
  }

  async getExperiment(id: string): Promise<ExperimentView | null> {
    const experiment = this.experiments.find((candidate) => candidate.id === id);
    if (!experiment) {
      return null;
    }
    return {
      ...structuredClone(experiment),
      entries: this.entries
        .filter((entry) => entry.experimentId === id)
        .sort((left, right) => left.sequence - right.sequence)
        .map((entry) => ({
          ...structuredClone(entry),
          amendments: this.amendments.filter((amendment) => amendment.entryId === entry.id).map((value) => structuredClone(value)),
          anchors: this.anchors.filter((anchor) => anchor.entryId === entry.id).map((value) => structuredClone(value)),
        })),
    };
  }

  async getLatestEntry(experimentId: string): Promise<RdlogEntry | null> {
    return structuredClone(this.entries
      .filter((entry) => entry.experimentId === experimentId)
      .sort((left, right) => right.sequence - left.sequence)[0] ?? null);
  }

  async listExperiments(workspaceId: string): Promise<RdlogExperiment[]> {
    return this.experiments
      .filter((experiment) => experiment.workspaceId === workspaceId)
      .map((experiment) => structuredClone(experiment));
  }

  async recordAnchors(anchors: RdlogAnchor[]): Promise<void> {
    this.anchors.push(...anchors.map((anchor) => structuredClone(anchor)));
  }

  async workspaceExists(id: string): Promise<boolean> {
    return this.workspaces.has(id);
  }
}

interface Harness {
  app: ReturnType<typeof createApi>;
  store: MemoryStore;
}

function createHarness(): Harness {
  const store = new MemoryStore();
  let nextId = 0;
  const app = createApi({
    makeId: () => `id-${(nextId += 1)}`,
    now: () => new Date("2026-08-16T01:02:03.000Z"),
    sessionSecret: "rdlog-test-secret-with-sufficient-length",
    store,
    webOrigin: "https://s72-rdlog.pages.dev",
  });
  return { app, store };
}

async function createWorkspace(app: ReturnType<typeof createApi>): Promise<string> {
  const response = await app.request("/api/workspace", { method: "POST" });
  const body = (await response.json()) as { token: string };
  expect(response.status).toBe(201);
  return body.token;
}

async function createExperiment(app: ReturnType<typeof createApi>, token: string): Promise<ExperimentView> {
  const response = await app.request("/api/experiments", {
    body: JSON.stringify({
      objective: "Determine whether the new cache layout reduces p95 latency under mixed load.",
      title: "Cache layout under mixed load",
    }),
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    method: "POST",
  });
  expect(response.status).toBe(201);
  return (await response.json()) as ExperimentView;
}

async function appendEntry(
  app: ReturnType<typeof createApi>,
  token: string,
  experimentId: string,
  kind: string,
  body: string,
): Promise<RdlogEntry> {
  const response = await app.request(`/api/experiments/${experimentId}/entries`, {
    body: JSON.stringify({ body, kind, occurredAt: "2026-08-16T01:00:00.000Z" }),
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    method: "POST",
  });
  expect(response.status).toBe(201);
  return (await response.json()) as RdlogEntry;
}

describe("rdlog API", () => {
  test("creates a private experiment and appends a deterministic SHA-256 chain", async () => {
    const { app } = createHarness();
    const token = await createWorkspace(app);
    const otherToken = await createWorkspace(app);
    const experiment = await createExperiment(app, token);

    const hypothesis = await appendEntry(
      app,
      token,
      experiment.id,
      "hypothesis",
      "Moving hot keys into a compact index will reduce p95 read latency by at least 15%.",
    );
    expect(hypothesis.sequence).toBe(1);
    expect(hypothesis.previousHash).toBeNull();
    await expect(canonicalEntryHash(hypothesis)).resolves.toBe(hypothesis.hash);

    const method = await appendEntry(
      app,
      token,
      experiment.id,
      "method",
      "Replay the same 60-minute production trace against both layouts with cache size fixed.",
    );
    expect(method.sequence).toBe(2);
    expect(method.previousHash).toBe(hypothesis.hash);
    await expect(canonicalEntryHash(method)).resolves.toBe(method.hash);

    const ownView = await app.request(`/api/experiments/${experiment.id}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    const hiddenView = await app.request(`/api/experiments/${experiment.id}`, {
      headers: { authorization: `Bearer ${otherToken}` },
    });
    expect(ownView.status).toBe(200);
    expect(((await ownView.json()) as ExperimentView).entries).toHaveLength(2);
    expect(hiddenView.status).toBe(404);
  });

  test("retains two exact OpenTimestamps receipts and links corrections as amendments", async () => {
    const { app } = createHarness();
    const token = await createWorkspace(app);
    const experiment = await createExperiment(app, token);
    const entry = await appendEntry(
      app,
      token,
      experiment.id,
      "observation",
      "The candidate layout returned p95 84 ms across 50,000 requests.",
    );

    const anchorResponse = await app.request(`/api/entries/${entry.id}/anchors`, {
      body: JSON.stringify({
        anchors: [
          { calendarUrl: "https://a.pool.opentimestamps.org", receipt: "AAEC", status: "pending" },
          { calendarUrl: "https://b.pool.opentimestamps.org", receipt: "AwQF", status: "pending" },
        ],
      }),
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      method: "POST",
    });
    expect(anchorResponse.status).toBe(201);
    expect((await anchorResponse.json()) as { anchors: RdlogAnchor[] }).toMatchObject({
      anchors: [
        { calendarUrl: "https://a.pool.opentimestamps.org", receipt: "AAEC" },
        { calendarUrl: "https://b.pool.opentimestamps.org", receipt: "AwQF" },
      ],
    });

    const amendmentResponse = await app.request(`/api/entries/${entry.id}/amendments`, {
      body: JSON.stringify({ body: "Correction: the run contained 55,000 requests; the measured p95 remains 84 ms." }),
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      method: "POST",
    });
    const amendment = (await amendmentResponse.json()) as RdlogAmendment;
    expect(amendmentResponse.status).toBe(201);
    expect(amendment.entryId).toBe(entry.id);
    expect(amendment.hash).toMatch(/^[a-f0-9]{64}$/u);

    const viewResponse = await app.request(`/api/experiments/${experiment.id}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    const view = (await viewResponse.json()) as ExperimentView;
    expect(view.entries[0]?.body).toBe(entry.body);
    expect(view.entries[0]?.amendments).toEqual([amendment]);
    expect(view.entries[0]?.anchors.map((anchor) => anchor.receipt)).toEqual(["AAEC", "AwQF"]);
  });

  test("exports an auditor-readable pack with the chain, receipts, sources and disclaimer", async () => {
    const { app } = createHarness();
    const token = await createWorkspace(app);
    const experiment = await createExperiment(app, token);
    await appendEntry(app, token, experiment.id, "evaluation", "The 18% p95 reduction exceeded the test threshold.");

    const response = await app.request(`/api/experiments/${experiment.id}/export`, {
      headers: { authorization: `Bearer ${token}` },
    });
    const pack = (await response.json()) as {
      disclaimer: string;
      experiment: ExperimentView;
      exportedAt: string;
      hashChainValid: boolean;
      primarySources: string[];
    };
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain("rdlog-");
    expect(pack.disclaimer).toContain("not tax advice");
    expect(pack.disclaimer).toContain("does not prove eligibility");
    expect(pack.hashChainValid).toBe(true);
    expect(pack.experiment.entries).toHaveLength(1);
    expect(pack.primarySources).toEqual(expect.arrayContaining([
      expect.stringContaining("business.gov.au"),
      expect.stringContaining("ato.gov.au"),
    ]));
    expect(pack.exportedAt).toBe("2026-08-16T01:02:03.000Z");
  });

  test("rejects unsupported entry kinds, future timestamps and incomplete anchor sets", async () => {
    const { app, store } = createHarness();
    const token = await createWorkspace(app);
    const experiment = await createExperiment(app, token);
    const unsupported = await app.request(`/api/experiments/${experiment.id}/entries`, {
      body: JSON.stringify({ body: "A body", kind: "eligible", occurredAt: "2026-08-16T01:00:00.000Z" }),
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      method: "POST",
    });
    const future = await app.request(`/api/experiments/${experiment.id}/entries`, {
      body: JSON.stringify({ body: "A body", kind: "note", occurredAt: "2026-08-17T01:00:00.000Z" }),
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      method: "POST",
    });
    const entry = await appendEntry(app, token, experiment.id, "note", "A contemporaneous project note.");
    const oneAnchor = await app.request(`/api/entries/${entry.id}/anchors`, {
      body: JSON.stringify({
        anchors: [{ calendarUrl: "https://a.pool.opentimestamps.org", receipt: "AAEC", status: "pending" }],
      }),
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      method: "POST",
    });

    expect(unsupported.status).toBe(400);
    expect(future.status).toBe(400);
    expect(oneAnchor.status).toBe(400);
    expect(store.anchors).toHaveLength(0);
  });
});
