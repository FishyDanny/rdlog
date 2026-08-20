import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { ExperimentList } from "./experiment-list";
import { ExperimentWorkspace } from "./experiment-workspace";
import type { ExperimentInput, ExperimentView, SubstantiationPack } from "./api";

const experiment: ExperimentView = {
  closedAt: null,
  entries: [{
    amendments: [{
      body: "Correction: the run contained 55,000 requests; p95 remains 84 ms.",
      createdAt: "2026-08-16T01:04:00.000Z",
      entryId: "entry-1",
      hash: "b".repeat(64),
      id: "amendment-1",
    }],
    anchors: [{
      anchoredAt: "2026-08-16T01:03:00.000Z",
      calendarUrl: "https://a.pool.opentimestamps.org",
      entryId: "entry-1",
      id: "anchor-1",
      receipt: "AAEC",
      status: "pending",
    }, {
      anchoredAt: "2026-08-16T01:03:00.000Z",
      calendarUrl: "https://b.pool.opentimestamps.org",
      entryId: "entry-1",
      id: "anchor-2",
      receipt: "AwQF",
      status: "pending",
    }],
    body: "The candidate layout returned p95 84 ms across 50,000 requests.",
    createdAt: "2026-08-16T01:02:03.000Z",
    experimentId: "experiment-1",
    hash: "a".repeat(64),
    id: "entry-1",
    kind: "observation",
    occurredAt: "2026-08-16T01:00:00.000Z",
    occurredAtOffsetMinutes: 600,
    previousHash: null,
    sequence: 1,
  }],
  id: "experiment-1",
  objective: "Determine whether the new cache layout reduces p95 latency under mixed load.",
  openedAt: "2026-08-16T00:00:00.000Z",
  status: "open",
  title: "Cache layout under mixed load",
  workspaceId: "workspace-1",
};

const emptyExperimentForm: ExperimentInput = { objective: "", title: "" };

describe("rdlog views", () => {
  test("explains the empty experiment desk with short, sourced record-keeping evidence", () => {
    const markup = renderToStaticMarkup(<ExperimentList
      busy={false}
      experiments={[]}
      form={emptyExperimentForm}
      message=""
      onCreate={() => undefined}
      onFormChange={() => undefined}
      onOpen={() => undefined}
    />);

    expect(markup).toContain("No experiments recorded yet.");
    expect(markup).toContain("Create an experiment, then add each observation while the work is happening.");
    expect(markup).toContain("Records should be created at the time the activity is conducted");
    expect(markup).toContain("business.gov.au");
    expect(markup).not.toContain("ATO approved");
  });

  test("places the legal limit immediately above the entry form and repeats it before export", () => {
    const pack: SubstantiationPack = {
      disclaimer: "Rdlog is a record-keeping tool only. It is not tax advice and does not prove eligibility.",
      experiment,
      exportedAt: "2026-08-16T01:05:00.000Z",
      hashChainValid: true,
      primarySources: ["https://business.gov.au/example", "https://ato.gov.au/example"],
      receiptNote: "Pending commitments.",
      schemaVersion: "rdlog-export-v1",
    };
    const markup = renderToStaticMarkup(<ExperimentWorkspace
      amendmentBodies={{}}
      busy={false}
      entryForm={{ body: "", kind: "observation", occurredAt: "2026-08-16T01:00", occurredAtOffsetMinutes: null }}
      experiment={experiment}
      message=""
      onAmend={() => undefined}
      onAmendmentChange={() => undefined}
      onBack={() => undefined}
      onEntryChange={() => undefined}
      onExport={() => undefined}
      onRecord={() => undefined}
      onRetryAnchor={() => undefined}
      pack={pack}
    />);
    const firstDisclaimer = markup.indexOf("Record-keeping only — not tax advice and not proof of R&amp;DTI eligibility.");
    const form = markup.indexOf('data-testid="new-entry-form"');
    const exportDisclaimer = markup.lastIndexOf("Record-keeping only — not tax advice and not proof of R&amp;DTI eligibility.");
    const exportButton = markup.indexOf('data-testid="prepare-export"');

    expect(firstDisclaimer).toBeGreaterThan(-1);
    expect(form).toBeGreaterThan(firstDisclaimer);
    expect(exportDisclaimer).toBeGreaterThan(form);
    expect(exportButton).toBeGreaterThan(exportDisclaimer);
  });

  test("shows append-only corrections, the hash chain and both exact calendar receipts", () => {
    const markup = renderToStaticMarkup(<ExperimentWorkspace
      amendmentBodies={{}}
      busy={false}
      entryForm={{ body: "", kind: "observation", occurredAt: "2026-08-16T01:00", occurredAtOffsetMinutes: null }}
      experiment={experiment}
      message=""
      onAmend={() => undefined}
      onAmendmentChange={() => undefined}
      onBack={() => undefined}
      onEntryChange={() => undefined}
      onExport={() => undefined}
      onRecord={() => undefined}
      onRetryAnchor={() => undefined}
      pack={null}
    />);

    expect(markup).toContain("Original record — never replaced");
    expect(markup).toContain("Linked correction");
    expect(markup).toContain("55,000 requests");
    expect(markup).toContain("2 calendar receipts captured");
    expect(markup).toContain("AAEC");
    expect(markup).toContain("AwQF");
    expect(markup).toContain("Pending Bitcoin confirmation");
  });
});
