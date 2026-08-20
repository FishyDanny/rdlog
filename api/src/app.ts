import { Hono } from "hono";
import { cors } from "hono/cors";
import { signToken, verifyToken } from "./tokens";

export type EntryKind = "conclusion" | "evaluation" | "hypothesis" | "method" | "note" | "observation";

export interface RdlogWorkspace {
  id: string;
  name: string;
  ownerEmail: string | null;
}

export interface RdlogExperiment {
  closedAt: string | null;
  id: string;
  objective: string;
  openedAt: string;
  status: "closed" | "open";
  title: string;
  workspaceId: string;
}

export interface RdlogEntry {
  body: string;
  createdAt: string;
  experimentId: string;
  hash: string;
  id: string;
  kind: EntryKind;
  occurredAt: string;
  occurredAtOffsetMinutes: number | null;
  previousHash: string | null;
  sequence: number;
}

export interface RdlogAmendment {
  body: string;
  createdAt: string;
  entryId: string;
  hash: string;
  id: string;
}

export interface RdlogAnchor {
  anchoredAt: string;
  calendarUrl: string;
  entryId: string;
  id: string;
  receipt: string;
  status: "confirmed" | "pending";
}

export interface EntryView extends RdlogEntry {
  amendments: RdlogAmendment[];
  anchors: RdlogAnchor[];
}

export interface ExperimentView extends RdlogExperiment {
  entries: EntryView[];
}

export interface RdlogStore {
  appendAmendment(amendment: RdlogAmendment): Promise<void>;
  appendEntry(entry: RdlogEntry): Promise<void>;
  createExperiment(experiment: RdlogExperiment): Promise<void>;
  createWorkspace(workspace: RdlogWorkspace): Promise<void>;
  getEntry(id: string): Promise<RdlogEntry | null>;
  getExperiment(id: string): Promise<ExperimentView | null>;
  getLatestEntry(experimentId: string): Promise<RdlogEntry | null>;
  listExperiments(workspaceId: string): Promise<RdlogExperiment[]>;
  recordAnchors(anchors: RdlogAnchor[]): Promise<void>;
  workspaceExists(id: string): Promise<boolean>;
}

export interface ApiDependencies {
  makeId: () => string;
  now: () => Date;
  sessionSecret: string;
  store: RdlogStore;
  webOrigin: string;
}

interface ExperimentInput {
  objective: string;
  title: string;
}

interface EntryInput {
  body: string;
  kind: EntryKind;
  occurredAt: string;
  occurredAtOffsetMinutes: number | null;
}

interface AmendmentInput {
  body: string;
}

interface AnchorInput {
  calendarUrl: string;
  receipt: string;
  status: "confirmed" | "pending";
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MAXIMUM_OFFSET_MINUTES = 14 * 60;
const ENTRY_KINDS = new Set<EntryKind>(["hypothesis", "method", "observation", "evaluation", "conclusion", "note"]);
const CALENDAR_URLS = new Set([
  "https://a.pool.opentimestamps.org",
  "https://b.pool.opentimestamps.org",
]);
const PRIMARY_SOURCES = [
  "https://business.gov.au/grants-and-programs/research-and-development-tax-incentive/check-if-you-are-eligible-for-the-randd-tax-incentive/record-keeping-for-the-rd-tax-incentive",
  "https://business.gov.au/grants-and-programs/research-and-development-tax-incentive/check-if-you-are-eligible-for-the-randd-tax-incentive/conducting-core-activities",
  "https://www.ato.gov.au/businesses-and-organisations/income-deductions-and-concessions/incentives-and-concessions/research-and-development-tax-incentive-and-concessions",
];
export const DISCLAIMER = "Rdlog is a record-keeping tool only. It is not tax advice, does not determine eligibility and does not prove eligibility for the R&DTI. It is not endorsed by the ATO or Department of Industry, Science and Resources.";

function readString(record: Record<string, unknown>, key: string, maximumLength: number): string | null {
  const value = record[key];
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= maximumLength ? trimmed : null;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function readExperimentInput(value: unknown): ExperimentInput | null {
  const record = readRecord(value);
  if (!record) {
    return null;
  }
  const title = readString(record, "title", 120);
  const objective = readString(record, "objective", 1_000);
  return title && objective ? { objective, title } : null;
}

function readOffsetMinutes(value: unknown): number | null | undefined {
  if (value === undefined || value === null) {
    return null;
  }
  return typeof value === "number" && Number.isInteger(value) && Math.abs(value) <= MAXIMUM_OFFSET_MINUTES
    ? value
    : undefined;
}

function readEntryInput(value: unknown, now: Date): EntryInput | null {
  const record = readRecord(value);
  if (!record) {
    return null;
  }
  const body = readString(record, "body", 10_000);
  const occurredAt = readString(record, "occurredAt", 40);
  const kind = record.kind;
  const occurredAtOffsetMinutes = readOffsetMinutes(record.occurredAtOffsetMinutes);
  if (
    !body || !occurredAt || occurredAtOffsetMinutes === undefined ||
    typeof kind !== "string" || !ENTRY_KINDS.has(kind as EntryKind)
  ) {
    return null;
  }
  const occurred = new Date(occurredAt);
  if (Number.isNaN(occurred.getTime()) || occurred.getTime() > now.getTime() + 5 * 60 * 1_000) {
    return null;
  }
  return { body, kind: kind as EntryKind, occurredAt: occurred.toISOString(), occurredAtOffsetMinutes };
}

function readAmendmentInput(value: unknown): AmendmentInput | null {
  const record = readRecord(value);
  const body = record ? readString(record, "body", 10_000) : null;
  return body ? { body } : null;
}

function readAnchors(value: unknown): AnchorInput[] | null {
  const record = readRecord(value);
  if (!record || !Array.isArray(record.anchors) || record.anchors.length !== 2) {
    return null;
  }
  const anchors: AnchorInput[] = [];
  for (const valueAnchor of record.anchors) {
    const anchor = readRecord(valueAnchor);
    const calendarUrl = anchor ? readString(anchor, "calendarUrl", 200) : null;
    const receipt = anchor ? readString(anchor, "receipt", 20_000) : null;
    const status = anchor?.status;
    if (
      !calendarUrl || !receipt || !CALENDAR_URLS.has(calendarUrl) ||
      !/^[A-Za-z0-9+/]+={0,2}$/u.test(receipt) ||
      (status !== "pending" && status !== "confirmed")
    ) {
      return null;
    }
    anchors.push({ calendarUrl, receipt, status });
  }
  return new Set(anchors.map((anchor) => anchor.calendarUrl)).size === 2 ? anchors : null;
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToHex(new Uint8Array(digest));
}

/**
 * Entries recorded before the daylight saving fix carry no offset and keep the
 * v1 preimage, so their stored hashes and the exported chain still verify. Once
 * an offset is recorded it is part of the record and enters the v2 preimage.
 */
export async function canonicalEntryHash(entry: Pick<
  RdlogEntry,
  | "body"
  | "createdAt"
  | "experimentId"
  | "kind"
  | "occurredAt"
  | "occurredAtOffsetMinutes"
  | "previousHash"
  | "sequence"
>): Promise<string> {
  const offsetMinutes = entry.occurredAtOffsetMinutes ?? null;
  return sha256(JSON.stringify(offsetMinutes === null
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
}

export async function canonicalAmendmentHash(
  amendment: Pick<RdlogAmendment, "body" | "createdAt" | "entryId">,
  entryHash: string,
): Promise<string> {
  return sha256(JSON.stringify([
    "rdlog-amendment-v1",
    amendment.entryId,
    amendment.body,
    amendment.createdAt,
    entryHash,
  ]));
}

async function workspaceFromRequest(request: Request, dependencies: ApiDependencies): Promise<string | null> {
  const authorisation = request.headers.get("authorization");
  if (!authorisation?.startsWith("Bearer ")) {
    return null;
  }
  const payload = await verifyToken(
    authorisation.slice("Bearer ".length),
    dependencies.sessionSecret,
    dependencies.now(),
  );
  if (payload?.kind !== "workspace" || !(await dependencies.store.workspaceExists(payload.subject))) {
    return null;
  }
  return payload.subject;
}

async function ownedExperiment(
  experimentId: string,
  workspaceId: string,
  store: RdlogStore,
): Promise<ExperimentView | null> {
  const experiment = await store.getExperiment(experimentId);
  return experiment?.workspaceId === workspaceId ? experiment : null;
}

async function ownedEntry(
  entryId: string,
  workspaceId: string,
  store: RdlogStore,
): Promise<RdlogEntry | null> {
  const entry = await store.getEntry(entryId);
  if (!entry) {
    return null;
  }
  return await ownedExperiment(entry.experimentId, workspaceId, store) ? entry : null;
}

async function hasValidHashChain(experiment: ExperimentView): Promise<boolean> {
  let previousHash: string | null = null;
  for (const entry of experiment.entries) {
    if (entry.previousHash !== previousHash || await canonicalEntryHash(entry) !== entry.hash) {
      return false;
    }
    previousHash = entry.hash;
  }
  return true;
}

export function createApi(dependencies: ApiDependencies) {
  const app = new Hono();
  app.use("/api/*", cors({
    allowHeaders: ["Authorization", "Content-Type"],
    exposeHeaders: ["Content-Disposition", "Content-Type"],
    origin: dependencies.webOrigin,
  }));

  app.get("/health", (context) => context.json({ ok: true }));

  app.post("/api/workspace", async (context) => {
    const workspace: RdlogWorkspace = {
      id: dependencies.makeId(),
      name: "Browser workspace",
      ownerEmail: null,
    };
    await dependencies.store.createWorkspace(workspace);
    const token = await signToken({
      expiresAt: dependencies.now().getTime() + 365 * DAY_MS,
      kind: "workspace",
      subject: workspace.id,
    }, dependencies.sessionSecret);
    return context.json({ token }, 201);
  });

  app.get("/api/experiments", async (context) => {
    const workspaceId = await workspaceFromRequest(context.req.raw, dependencies);
    if (!workspaceId) {
      return context.json({ error: "A valid browser workspace is required." }, 401);
    }
    return context.json({ experiments: await dependencies.store.listExperiments(workspaceId) });
  });

  app.post("/api/experiments", async (context) => {
    const workspaceId = await workspaceFromRequest(context.req.raw, dependencies);
    if (!workspaceId) {
      return context.json({ error: "A valid browser workspace is required." }, 401);
    }
    const input = readExperimentInput(await context.req.json().catch(() => null));
    if (!input) {
      return context.json({ error: "Enter a title and a clear experiment objective." }, 400);
    }
    const experiment: RdlogExperiment = {
      closedAt: null,
      id: dependencies.makeId(),
      objective: input.objective,
      openedAt: dependencies.now().toISOString(),
      status: "open",
      title: input.title,
      workspaceId,
    };
    await dependencies.store.createExperiment(experiment);
    return context.json({ ...experiment, entries: [] } satisfies ExperimentView, 201);
  });

  app.get("/api/experiments/:id", async (context) => {
    const workspaceId = await workspaceFromRequest(context.req.raw, dependencies);
    if (!workspaceId) {
      return context.json({ error: "A valid browser workspace is required." }, 401);
    }
    const experiment = await ownedExperiment(context.req.param("id"), workspaceId, dependencies.store);
    return experiment
      ? context.json(experiment)
      : context.json({ error: "Experiment not found in this workspace." }, 404);
  });

  app.post("/api/experiments/:id/entries", async (context) => {
    const workspaceId = await workspaceFromRequest(context.req.raw, dependencies);
    if (!workspaceId) {
      return context.json({ error: "A valid browser workspace is required." }, 401);
    }
    const experiment = await ownedExperiment(context.req.param("id"), workspaceId, dependencies.store);
    if (!experiment) {
      return context.json({ error: "Experiment not found in this workspace." }, 404);
    }
    const now = dependencies.now();
    const input = readEntryInput(await context.req.json().catch(() => null), now);
    if (!input) {
      return context.json({ error: "Choose a record type, enter the work performed and use a valid occurrence time." }, 400);
    }
    const previous = await dependencies.store.getLatestEntry(experiment.id);
    const entryWithoutHash: Omit<RdlogEntry, "hash"> = {
      body: input.body,
      createdAt: now.toISOString(),
      experimentId: experiment.id,
      id: dependencies.makeId(),
      kind: input.kind,
      occurredAt: input.occurredAt,
      occurredAtOffsetMinutes: input.occurredAtOffsetMinutes,
      previousHash: previous?.hash ?? null,
      sequence: (previous?.sequence ?? 0) + 1,
    };
    const entry: RdlogEntry = { ...entryWithoutHash, hash: await canonicalEntryHash(entryWithoutHash) };
    await dependencies.store.appendEntry(entry);
    return context.json(entry, 201);
  });

  app.post("/api/entries/:id/amendments", async (context) => {
    const workspaceId = await workspaceFromRequest(context.req.raw, dependencies);
    if (!workspaceId) {
      return context.json({ error: "A valid browser workspace is required." }, 401);
    }
    const entry = await ownedEntry(context.req.param("id"), workspaceId, dependencies.store);
    if (!entry) {
      return context.json({ error: "Entry not found in this workspace." }, 404);
    }
    const input = readAmendmentInput(await context.req.json().catch(() => null));
    if (!input) {
      return context.json({ error: "Enter a correction that explains the amended record." }, 400);
    }
    const amendmentWithoutHash: Omit<RdlogAmendment, "hash"> = {
      body: input.body,
      createdAt: dependencies.now().toISOString(),
      entryId: entry.id,
      id: dependencies.makeId(),
    };
    const amendment: RdlogAmendment = {
      ...amendmentWithoutHash,
      hash: await canonicalAmendmentHash(amendmentWithoutHash, entry.hash),
    };
    await dependencies.store.appendAmendment(amendment);
    return context.json(amendment, 201);
  });

  app.post("/api/entries/:id/anchors", async (context) => {
    const workspaceId = await workspaceFromRequest(context.req.raw, dependencies);
    if (!workspaceId) {
      return context.json({ error: "A valid browser workspace is required." }, 401);
    }
    const entry = await ownedEntry(context.req.param("id"), workspaceId, dependencies.store);
    if (!entry) {
      return context.json({ error: "Entry not found in this workspace." }, 404);
    }
    const input = readAnchors(await context.req.json().catch(() => null));
    if (!input) {
      return context.json({ error: "Two distinct, valid OpenTimestamps calendar receipts are required." }, 400);
    }
    const anchoredAt = dependencies.now().toISOString();
    const anchors: RdlogAnchor[] = input.map((anchor) => ({
      ...anchor,
      anchoredAt,
      entryId: entry.id,
      id: dependencies.makeId(),
    }));
    await dependencies.store.recordAnchors(anchors);
    return context.json({ anchors }, 201);
  });

  app.get("/api/experiments/:id/export", async (context) => {
    const workspaceId = await workspaceFromRequest(context.req.raw, dependencies);
    if (!workspaceId) {
      return context.json({ error: "A valid browser workspace is required." }, 401);
    }
    const experiment = await ownedExperiment(context.req.param("id"), workspaceId, dependencies.store);
    if (!experiment) {
      return context.json({ error: "Experiment not found in this workspace." }, 404);
    }
    const filename = `rdlog-${experiment.id}.json`;
    return context.json({
      disclaimer: DISCLAIMER,
      experiment,
      exportedAt: dependencies.now().toISOString(),
      hashChainValid: await hasValidHashChain(experiment),
      primarySources: PRIMARY_SOURCES,
      receiptNote: "OpenTimestamps calendar receipts are pending commitments until upgraded and independently verified against Bitcoin.",
      schemaVersion: "rdlog-export-v1",
    }, 200, {
      "content-disposition": `attachment; filename="${filename}"`,
    });
  });

  return app;
}
