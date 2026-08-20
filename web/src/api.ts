import type { CalendarAnchor } from "./timestamps";

export interface BrowserStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;
export type EntryKind = "conclusion" | "evaluation" | "hypothesis" | "method" | "note" | "observation";

export interface ExperimentSummary {
  closedAt: string | null;
  id: string;
  objective: string;
  openedAt: string;
  status: "closed" | "open";
  title: string;
  workspaceId: string;
}

export interface EntryRecord {
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

export interface AmendmentRecord {
  body: string;
  createdAt: string;
  entryId: string;
  hash: string;
  id: string;
}

export interface AnchorRecord {
  anchoredAt: string;
  calendarUrl: string;
  entryId: string;
  id: string;
  receipt: string;
  status: "confirmed" | "pending";
}

export interface EntryView extends EntryRecord {
  amendments: AmendmentRecord[];
  anchors: AnchorRecord[];
}

export interface ExperimentView extends ExperimentSummary {
  entries: EntryView[];
}

export interface ExperimentInput {
  objective: string;
  title: string;
}

export interface EntryInput {
  body: string;
  kind: EntryKind;
  occurredAt: string;
  occurredAtOffsetMinutes: number | null;
}

export interface SubstantiationPack {
  disclaimer: string;
  experiment: ExperimentView;
  exportedAt: string;
  hashChainValid: boolean;
  primarySources: string[];
  receiptNote: string;
  schemaVersion: "rdlog-export-v1";
}

interface WorkspaceResponse {
  token: string;
}

const WORKSPACE_KEY = "s72-rdlog-workspace";

function recordOf(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function isWorkspaceResponse(value: unknown): value is WorkspaceResponse {
  return typeof recordOf(value)?.token === "string";
}

function isExperimentSummary(value: unknown): value is ExperimentSummary {
  const record = recordOf(value);
  return !!record &&
    typeof record.id === "string" &&
    typeof record.title === "string" &&
    typeof record.objective === "string" &&
    typeof record.workspaceId === "string" &&
    typeof record.openedAt === "string" &&
    (record.status === "open" || record.status === "closed");
}

function isEntryRecord(value: unknown): value is EntryRecord {
  const record = recordOf(value);
  return !!record &&
    typeof record.id === "string" &&
    typeof record.experimentId === "string" &&
    typeof record.body === "string" &&
    typeof record.kind === "string" &&
    typeof record.occurredAt === "string" &&
    typeof record.createdAt === "string" &&
    typeof record.hash === "string" &&
    (record.occurredAtOffsetMinutes === null || record.occurredAtOffsetMinutes === undefined ||
      typeof record.occurredAtOffsetMinutes === "number") &&
    typeof record.sequence === "number";
}

function isExperimentView(value: unknown): value is ExperimentView {
  const record = recordOf(value);
  return isExperimentSummary(value) && Array.isArray(record?.entries);
}

function isAmendmentRecord(value: unknown): value is AmendmentRecord {
  const record = recordOf(value);
  return !!record &&
    typeof record.id === "string" &&
    typeof record.entryId === "string" &&
    typeof record.body === "string" &&
    typeof record.createdAt === "string" &&
    typeof record.hash === "string";
}

function isAnchorRecord(value: unknown): value is AnchorRecord {
  const record = recordOf(value);
  return !!record &&
    typeof record.id === "string" &&
    typeof record.entryId === "string" &&
    typeof record.calendarUrl === "string" &&
    typeof record.receipt === "string" &&
    typeof record.anchoredAt === "string" &&
    (record.status === "pending" || record.status === "confirmed");
}

function isSubstantiationPack(value: unknown): value is SubstantiationPack {
  const record = recordOf(value);
  return !!record &&
    record.schemaVersion === "rdlog-export-v1" &&
    typeof record.disclaimer === "string" &&
    typeof record.exportedAt === "string" &&
    typeof record.hashChainValid === "boolean" &&
    Array.isArray(record.primarySources) &&
    typeof record.receiptNote === "string" &&
    isExperimentView(record.experiment);
}

async function readJson(response: Response): Promise<unknown> {
  const value: unknown = await response.json();
  if (!response.ok) {
    const record = recordOf(value);
    throw new Error(typeof record?.error === "string" ? record.error : `Request failed with ${response.status}.`);
  }
  return value;
}

function authorised(token: string, body?: unknown): RequestInit {
  const headers = new Headers({ authorization: `Bearer ${token}` });
  if (body !== undefined) {
    headers.set("content-type", "application/json");
  }
  return {
    body: body === undefined ? undefined : JSON.stringify(body),
    headers,
  };
}

export async function ensureWorkspace(storage: BrowserStorage, fetcher: Fetcher, apiUrl: string): Promise<string> {
  const existing = storage.getItem(WORKSPACE_KEY);
  if (existing) {
    return existing;
  }
  const value = await readJson(await fetcher(`${apiUrl}/api/workspace`, { method: "POST" }));
  if (!isWorkspaceResponse(value)) {
    throw new Error("Workspace response was invalid.");
  }
  storage.setItem(WORKSPACE_KEY, value.token);
  return value.token;
}

export async function listExperiments(fetcher: Fetcher, apiUrl: string, token: string): Promise<ExperimentSummary[]> {
  const value = await readJson(await fetcher(`${apiUrl}/api/experiments`, authorised(token)));
  const experiments = recordOf(value)?.experiments;
  if (!Array.isArray(experiments) || !experiments.every(isExperimentSummary)) {
    throw new Error("Experiment list response was invalid.");
  }
  return experiments;
}

export async function createExperiment(
  fetcher: Fetcher,
  apiUrl: string,
  token: string,
  input: ExperimentInput,
): Promise<ExperimentView> {
  const value = await readJson(await fetcher(`${apiUrl}/api/experiments`, {
    ...authorised(token, input),
    method: "POST",
  }));
  if (!isExperimentView(value)) {
    throw new Error("Created experiment response was invalid.");
  }
  return value;
}

export async function getExperiment(
  fetcher: Fetcher,
  apiUrl: string,
  token: string,
  experimentId: string,
): Promise<ExperimentView> {
  const value = await readJson(await fetcher(`${apiUrl}/api/experiments/${experimentId}`, authorised(token)));
  if (!isExperimentView(value)) {
    throw new Error("Experiment response was invalid.");
  }
  return value;
}

export async function appendEntry(
  fetcher: Fetcher,
  apiUrl: string,
  token: string,
  experimentId: string,
  input: EntryInput,
): Promise<EntryRecord> {
  const value = await readJson(await fetcher(`${apiUrl}/api/experiments/${experimentId}/entries`, {
    ...authorised(token, input),
    method: "POST",
  }));
  if (!isEntryRecord(value)) {
    throw new Error("Created entry response was invalid.");
  }
  return value;
}

export async function saveAnchors(
  fetcher: Fetcher,
  apiUrl: string,
  token: string,
  entryId: string,
  anchors: CalendarAnchor[],
): Promise<AnchorRecord[]> {
  const value = await readJson(await fetcher(`${apiUrl}/api/entries/${entryId}/anchors`, {
    ...authorised(token, { anchors }),
    method: "POST",
  }));
  const records = recordOf(value)?.anchors;
  if (!Array.isArray(records) || !records.every(isAnchorRecord)) {
    throw new Error("Saved anchor response was invalid.");
  }
  return records;
}

export async function appendAmendment(
  fetcher: Fetcher,
  apiUrl: string,
  token: string,
  entryId: string,
  body: string,
): Promise<AmendmentRecord> {
  const value = await readJson(await fetcher(`${apiUrl}/api/entries/${entryId}/amendments`, {
    ...authorised(token, { body }),
    method: "POST",
  }));
  if (!isAmendmentRecord(value)) {
    throw new Error("Created amendment response was invalid.");
  }
  return value;
}

export async function readExport(
  fetcher: Fetcher,
  apiUrl: string,
  token: string,
  experimentId: string,
): Promise<SubstantiationPack> {
  const value = await readJson(await fetcher(`${apiUrl}/api/experiments/${experimentId}/export`, authorised(token)));
  if (!isSubstantiationPack(value)) {
    throw new Error("Export response was invalid.");
  }
  return value;
}
