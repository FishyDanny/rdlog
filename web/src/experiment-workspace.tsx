import type { FormEvent } from "react";
import type { EntryInput, EntryKind, ExperimentView, SubstantiationPack } from "./api";

export interface ExperimentWorkspaceProps {
  amendmentBodies: Record<string, string | undefined>;
  busy: boolean;
  entryForm: EntryInput;
  experiment: ExperimentView;
  message: string;
  onAmend(entryId: string): void;
  onAmendmentChange(entryId: string, body: string): void;
  onBack(): void;
  onEntryChange(next: EntryInput): void;
  onExport(): void;
  onRecord(): void;
  onRetryAnchor(entryId: string): void;
  pack: SubstantiationPack | null;
}

const ENTRY_OPTIONS: ReadonlyArray<{ label: string; value: EntryKind }> = [
  { label: "Hypothesis", value: "hypothesis" },
  { label: "Method / experiment", value: "method" },
  { label: "Observation", value: "observation" },
  { label: "Evaluation", value: "evaluation" },
  { label: "Logical conclusion", value: "conclusion" },
  { label: "Project note", value: "note" },
];

function kindLabel(kind: EntryKind): string {
  return ENTRY_OPTIONS.find((option) => option.value === kind)?.label ?? kind;
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function shortHash(value: string | null): string {
  return value ? `${value.slice(0, 12)}…${value.slice(-8)}` : "start of chain";
}

export function ExperimentWorkspace({
  amendmentBodies,
  busy,
  entryForm,
  experiment,
  message,
  onAmend,
  onAmendmentChange,
  onBack,
  onEntryChange,
  onExport,
  onRecord,
  onRetryAnchor,
  pack,
}: ExperimentWorkspaceProps) {
  function submitEntry(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    onRecord();
  }

  return (
    <>
      <header className="site-header workspace-header">
        <button className="back-button" data-testid="back-to-experiments" onClick={onBack} type="button">← Experiments</button>
        <a className="wordmark" href="/" aria-label="Rdlog home"><span>RD</span> log</a>
        <p>{experiment.entries.length} immutable {experiment.entries.length === 1 ? "entry" : "entries"}</p>
      </header>

      <main className="workspace-layout">
        <aside className="experiment-summary">
          <p className="eyebrow">Open experiment</p>
          <h1>{experiment.title}</h1>
          <p>{experiment.objective}</p>
          <dl>
            <div><dt>Opened</dt><dd>{formatDateTime(experiment.openedAt)}</dd></div>
            <div><dt>Status</dt><dd>{experiment.status}</dd></div>
            <div><dt>Chain</dt><dd>{experiment.entries.length === 0 ? "Waiting for first entry" : `${experiment.entries.length} linked hashes`}</dd></div>
          </dl>
          <p className="privacy-mini">Text and receipts are stored in Cloudflare D1. Calendars receive hashes only.</p>
        </aside>

        <div className="record-column">
          <section className="entry-panel" aria-labelledby="new-entry-heading">
            <div className="section-heading">
              <p>Append-only record</p>
              <h2 id="new-entry-heading">Record the work now</h2>
            </div>
            <div className="legal-limit">Record-keeping only — not tax advice and not proof of R&amp;DTI eligibility.</div>
            <form data-testid="new-entry-form" onSubmit={submitEntry}>
              <label>Record type
                <select
                  data-testid="entry-kind"
                  onChange={(event) => onEntryChange({ ...entryForm, kind: event.target.value as EntryKind })}
                  value={entryForm.kind}
                >
                  {ENTRY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label>When the work occurred
                <input
                  data-testid="entry-occurred-at"
                  onChange={(event) => onEntryChange({ ...entryForm, occurredAt: event.target.value })}
                  required
                  type="datetime-local"
                  value={entryForm.occurredAt}
                />
              </label>
              <label className="full-field">What happened
                <textarea
                  data-testid="entry-body"
                  maxLength={10_000}
                  onChange={(event) => onEntryChange({ ...entryForm, body: event.target.value })}
                  placeholder="State the hypothesis, method, observation, evaluation or conclusion in concrete terms."
                  required
                  rows={6}
                  value={entryForm.body}
                />
              </label>
              <button className="primary-action sticky-submit" data-testid="record-entry" disabled={busy} type="submit">
                {busy ? "Hashing and contacting calendars…" : "Hash, anchor and append"}
              </button>
            </form>
            <p aria-live="polite" className="status-message" data-testid="record-message" role="status">{message}</p>
          </section>

          <section className="timeline" aria-labelledby="timeline-heading">
            <div className="section-heading">
              <p>Hash-linked history</p>
              <h2 id="timeline-heading">Experiment record</h2>
            </div>
            {experiment.entries.length === 0 ? (
              <div className="empty-state"><strong>No entries yet.</strong><p>Add the hypothesis or first contemporaneous note above.</p></div>
            ) : experiment.entries.map((entry) => (
              <article className="entry-card" data-testid="entry-card" key={entry.id}>
                <header>
                  <span className="sequence">{String(entry.sequence).padStart(2, "0")}</span>
                  <div><p>{kindLabel(entry.kind)}</p><time dateTime={entry.occurredAt}>{formatDateTime(entry.occurredAt)}</time></div>
                </header>
                <div className="original-record">
                  <strong>Original record — never replaced</strong>
                  <p>{entry.body}</p>
                </div>
                <dl className="hash-grid">
                  <div><dt>SHA-256</dt><dd title={entry.hash}>{shortHash(entry.hash)}</dd></div>
                  <div><dt>Previous</dt><dd title={entry.previousHash ?? undefined}>{shortHash(entry.previousHash)}</dd></div>
                </dl>
                {entry.anchors.length === 2 ? (
                  <div className="receipt-box">
                    <strong>2 calendar receipts captured</strong>
                    <span>Pending Bitcoin confirmation</span>
                    {entry.anchors.map((anchor) => (
                      <details key={anchor.id}>
                        <summary>{new URL(anchor.calendarUrl).host}</summary>
                        <code>{anchor.receipt}</code>
                      </details>
                    ))}
                  </div>
                ) : (
                  <div className="anchor-warning">
                    <p>This entry is hashed but does not yet have both calendar receipts.</p>
                    <button disabled={busy} onClick={() => onRetryAnchor(entry.id)} type="button">Retry two-calendar anchor</button>
                  </div>
                )}
                {entry.amendments.map((amendment) => (
                  <div className="amendment" key={amendment.id}>
                    <strong>Linked correction</strong>
                    <time dateTime={amendment.createdAt}>{formatDateTime(amendment.createdAt)}</time>
                    <p>{amendment.body}</p>
                    <code title={amendment.hash}>{shortHash(amendment.hash)}</code>
                  </div>
                ))}
                <details className="correction-form">
                  <summary>Add a linked correction</summary>
                  <label>Correction and reason
                    <textarea
                      data-testid={`amendment-body-${entry.id}`}
                      onChange={(event) => onAmendmentChange(entry.id, event.target.value)}
                      rows={3}
                      value={amendmentBodies[entry.id] ?? ""}
                    />
                  </label>
                  <button data-testid={`add-amendment-${entry.id}`} disabled={busy || !(amendmentBodies[entry.id]?.trim())} onClick={() => onAmend(entry.id)} type="button">Append correction</button>
                </details>
              </article>
            ))}
          </section>

          <section className="export-panel" aria-labelledby="export-heading">
            <div className="section-heading">
              <p>Substantiation pack</p>
              <h2 id="export-heading">Export the record and receipts</h2>
            </div>
            <div className="legal-limit">Record-keeping only — not tax advice and not proof of R&amp;DTI eligibility.</div>
            <p>The JSON pack includes the original entries, linked amendments, complete SHA-256 chain and exact base64 calendar responses. Fresh receipts remain pending until upgraded and independently verified.</p>
            <button data-testid="prepare-export" disabled={busy || experiment.entries.length === 0} onClick={onExport} type="button">Prepare and download JSON pack</button>
            {pack && (
              <div className="export-result" data-testid="export-result">
                <strong>{pack.hashChainValid ? "Hash chain verified in this export" : "Hash chain validation failed"}</strong>
                <span>{pack.experiment.entries.length} entries · exported {formatDateTime(pack.exportedAt)}</span>
              </div>
            )}
          </section>
        </div>
      </main>

      <footer className="site-footer">
        <p>Official guidance: <a href="https://business.gov.au/grants-and-programs/research-and-development-tax-incentive/check-if-you-are-eligible-for-the-randd-tax-incentive/record-keeping-for-the-rd-tax-incentive">record keeping</a> and <a href="https://business.gov.au/grants-and-programs/research-and-development-tax-incentive/check-if-you-are-eligible-for-the-randd-tax-incentive/conducting-core-activities">core R&amp;D activities</a>.</p>
        <a href="https://github.com/FishyDanny/ship72">Public source</a>
      </footer>
    </>
  );
}
