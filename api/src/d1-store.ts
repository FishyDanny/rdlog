import type {
  EntryKind,
  ExperimentView,
  RdlogAmendment,
  RdlogAnchor,
  RdlogEntry,
  RdlogExperiment,
  RdlogStore,
  RdlogWorkspace,
} from "./app";

export interface D1ExperimentRow {
  amendmentBody: string | null;
  amendmentCreatedAt: string | null;
  amendmentHash: string | null;
  amendmentId: string | null;
  anchorAnchoredAt: string | null;
  anchorCalendarUrl: string | null;
  anchorId: string | null;
  anchorReceipt: string | null;
  anchorStatus: "confirmed" | "pending" | null;
  closedAt: string | null;
  entryBody: string | null;
  entryCreatedAt: string | null;
  entryHash: string | null;
  entryId: string | null;
  entryKind: EntryKind | null;
  entryOccurredAt: string | null;
  entryOccurredAtOffsetMinutes: number | null;
  entryPreviousHash: string | null;
  entrySequence: number | null;
  experimentId: string;
  objective: string;
  openedAt: string;
  status: "closed" | "open";
  title: string;
  workspaceId: string;
}

const EXPERIMENT_SELECT = `
  SELECT
    x.id AS experimentId,
    x.workspace_id AS workspaceId,
    x.title,
    x.objective,
    x.status,
    x.opened_at AS openedAt,
    x.closed_at AS closedAt,
    e.id AS entryId,
    e.kind AS entryKind,
    e.body AS entryBody,
    e.occurred_at AS entryOccurredAt,
    e.occurred_at_offset_minutes AS entryOccurredAtOffsetMinutes,
    e.created_at AS entryCreatedAt,
    e.hash AS entryHash,
    e.previous_hash AS entryPreviousHash,
    e.sequence AS entrySequence,
    a.id AS amendmentId,
    a.body AS amendmentBody,
    a.created_at AS amendmentCreatedAt,
    a.hash AS amendmentHash,
    o.id AS anchorId,
    o.calendar_url AS anchorCalendarUrl,
    o.receipt AS anchorReceipt,
    o.anchored_at AS anchorAnchoredAt,
    o.status AS anchorStatus
  FROM rdlog_experiments x
  LEFT JOIN rdlog_entries e ON e.experiment_id = x.id
  LEFT JOIN rdlog_amendments a ON a.entry_id = e.id
  LEFT JOIN rdlog_anchors o ON o.entry_id = e.id
`;

function rowEntry(row: D1ExperimentRow): ExperimentView["entries"][number] | null {
  if (
    row.entryId === null || row.entryKind === null || row.entryBody === null ||
    row.entryOccurredAt === null || row.entryCreatedAt === null || row.entryHash === null ||
    row.entrySequence === null
  ) {
    return null;
  }
  return {
    amendments: [],
    anchors: [],
    body: row.entryBody,
    createdAt: row.entryCreatedAt,
    experimentId: row.experimentId,
    hash: row.entryHash,
    id: row.entryId,
    kind: row.entryKind,
    occurredAt: row.entryOccurredAt,
    occurredAtOffsetMinutes: row.entryOccurredAtOffsetMinutes,
    previousHash: row.entryPreviousHash,
    sequence: row.entrySequence,
  };
}

function rowAmendment(row: D1ExperimentRow): RdlogAmendment | null {
  if (
    row.entryId === null || row.amendmentId === null || row.amendmentBody === null ||
    row.amendmentCreatedAt === null || row.amendmentHash === null
  ) {
    return null;
  }
  return {
    body: row.amendmentBody,
    createdAt: row.amendmentCreatedAt,
    entryId: row.entryId,
    hash: row.amendmentHash,
    id: row.amendmentId,
  };
}

function rowAnchor(row: D1ExperimentRow): RdlogAnchor | null {
  if (
    row.entryId === null || row.anchorId === null || row.anchorCalendarUrl === null ||
    row.anchorReceipt === null || row.anchorAnchoredAt === null || row.anchorStatus === null
  ) {
    return null;
  }
  return {
    anchoredAt: row.anchorAnchoredAt,
    calendarUrl: row.anchorCalendarUrl,
    entryId: row.entryId,
    id: row.anchorId,
    receipt: row.anchorReceipt,
    status: row.anchorStatus,
  };
}

export function groupExperimentRows(rows: D1ExperimentRow[]): ExperimentView[] {
  const experiments = new Map<string, ExperimentView>();
  for (const row of rows) {
    let experiment = experiments.get(row.experimentId);
    if (!experiment) {
      experiment = {
        closedAt: row.closedAt,
        entries: [],
        id: row.experimentId,
        objective: row.objective,
        openedAt: row.openedAt,
        status: row.status,
        title: row.title,
        workspaceId: row.workspaceId,
      };
      experiments.set(row.experimentId, experiment);
    }
    const mappedEntry = rowEntry(row);
    if (!mappedEntry) {
      continue;
    }
    let entry = experiment.entries.find((candidate) => candidate.id === mappedEntry.id);
    if (!entry) {
      entry = mappedEntry;
      experiment.entries.push(entry);
    }
    const amendment = rowAmendment(row);
    if (amendment && !entry.amendments.some((candidate) => candidate.id === amendment.id)) {
      entry.amendments.push(amendment);
    }
    const anchor = rowAnchor(row);
    if (anchor && !entry.anchors.some((candidate) => candidate.id === anchor.id)) {
      entry.anchors.push(anchor);
    }
  }
  return [...experiments.values()].map((experiment) => ({
    ...experiment,
    entries: experiment.entries.sort((left, right) => left.sequence - right.sequence),
  }));
}

export function createD1RdlogStore(database: D1Database): RdlogStore {
  return {
    async appendAmendment(amendment: RdlogAmendment): Promise<void> {
      await database.prepare(
        "INSERT INTO rdlog_amendments (id, entry_id, body, created_at, hash) VALUES (?, ?, ?, ?, ?)",
      ).bind(amendment.id, amendment.entryId, amendment.body, amendment.createdAt, amendment.hash).run();
    },
    async appendEntry(entry: RdlogEntry): Promise<void> {
      await database.prepare(`
        INSERT INTO rdlog_entries
          (id, experiment_id, kind, body, occurred_at, occurred_at_offset_minutes, created_at, hash, previous_hash, sequence)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        entry.id,
        entry.experimentId,
        entry.kind,
        entry.body,
        entry.occurredAt,
        entry.occurredAtOffsetMinutes,
        entry.createdAt,
        entry.hash,
        entry.previousHash,
        entry.sequence,
      ).run();
    },
    async createExperiment(experiment: RdlogExperiment): Promise<void> {
      await database.prepare(`
        INSERT INTO rdlog_experiments
          (id, workspace_id, title, objective, status, opened_at, closed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        experiment.id,
        experiment.workspaceId,
        experiment.title,
        experiment.objective,
        experiment.status,
        experiment.openedAt,
        experiment.closedAt,
      ).run();
    },
    async createWorkspace(workspace: RdlogWorkspace): Promise<void> {
      await database.prepare(
        "INSERT INTO rdlog_workspaces (id, owner_email, name) VALUES (?, ?, ?)",
      ).bind(workspace.id, workspace.ownerEmail, workspace.name).run();
    },
    async getEntry(id: string): Promise<RdlogEntry | null> {
      return database.prepare(`
        SELECT
          id,
          experiment_id AS experimentId,
          kind,
          body,
          occurred_at AS occurredAt,
          occurred_at_offset_minutes AS occurredAtOffsetMinutes,
          created_at AS createdAt,
          hash,
          previous_hash AS previousHash,
          sequence
        FROM rdlog_entries
        WHERE id = ?
      `).bind(id).first<RdlogEntry>();
    },
    async getExperiment(id: string): Promise<ExperimentView | null> {
      const result = await database.prepare(`
        ${EXPERIMENT_SELECT}
        WHERE x.id = ?
        ORDER BY e.sequence ASC, a.created_at ASC, o.calendar_url ASC
      `).bind(id).all<D1ExperimentRow>();
      return groupExperimentRows(result.results)[0] ?? null;
    },
    async getLatestEntry(experimentId: string): Promise<RdlogEntry | null> {
      return database.prepare(`
        SELECT
          id,
          experiment_id AS experimentId,
          kind,
          body,
          occurred_at AS occurredAt,
          occurred_at_offset_minutes AS occurredAtOffsetMinutes,
          created_at AS createdAt,
          hash,
          previous_hash AS previousHash,
          sequence
        FROM rdlog_entries
        WHERE experiment_id = ?
        ORDER BY sequence DESC
        LIMIT 1
      `).bind(experimentId).first<RdlogEntry>();
    },
    async listExperiments(workspaceId: string): Promise<RdlogExperiment[]> {
      const result = await database.prepare(`
        SELECT
          id,
          workspace_id AS workspaceId,
          title,
          objective,
          status,
          opened_at AS openedAt,
          closed_at AS closedAt
        FROM rdlog_experiments
        WHERE workspace_id = ?
        ORDER BY opened_at DESC
      `).bind(workspaceId).all<RdlogExperiment>();
      return result.results;
    },
    async recordAnchors(anchors: RdlogAnchor[]): Promise<void> {
      await database.batch(anchors.map((anchor) => database.prepare(`
        INSERT INTO rdlog_anchors
          (id, entry_id, calendar_url, receipt, anchored_at, status)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        anchor.id,
        anchor.entryId,
        anchor.calendarUrl,
        anchor.receipt,
        anchor.anchoredAt,
        anchor.status,
      )));
    },
    async workspaceExists(id: string): Promise<boolean> {
      return await database.prepare("SELECT id FROM rdlog_workspaces WHERE id = ?")
        .bind(id)
        .first<{ id: string }>() !== null;
    },
  };
}
