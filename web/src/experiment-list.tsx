import type { FormEvent } from "react";
import type { ExperimentInput, ExperimentSummary } from "./api";

export interface ExperimentListProps {
  busy: boolean;
  experiments: ExperimentSummary[];
  form: ExperimentInput;
  message: string;
  onCreate(): void;
  onFormChange(next: ExperimentInput): void;
  onOpen(experimentId: string): void;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric" })
    .format(new Date(value));
}

export function ExperimentList({
  busy,
  experiments,
  form,
  message,
  onCreate,
  onFormChange,
  onOpen,
}: ExperimentListProps) {
  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    onCreate();
  }

  return (
    <>
      <header className="site-header">
        <a className="wordmark" href="/" aria-label="Rdlog home"><span>RD</span> log</a>
        <p>Contemporaneous experiment records</p>
      </header>

      <main className="desk-layout">
        <aside className="intro-rail">
          <p className="eyebrow">R&amp;D work, recorded while it happens</p>
          <h1>Build the record before memory fills the gaps.</h1>
          <p className="lede">Open an experiment, record each step, and keep a hash-linked history with two independent OpenTimestamps calendar receipts.</p>
          <blockquote>
            “Records should be created at the time the activity is conducted.”
            <cite><a href="https://business.gov.au/grants-and-programs/research-and-development-tax-incentive/check-if-you-are-eligible-for-the-randd-tax-incentive/record-keeping-for-the-rd-tax-incentive">Record keeping for the R&amp;D Tax Incentive — business.gov.au</a></cite>
          </blockquote>
          <p className="source-note">The official guidance supports contemporaneous records. Rdlog does not assess whether an activity is eligible.</p>
        </aside>

        <div className="work-area">
          <section className="create-panel" aria-labelledby="new-experiment-heading">
            <div className="section-heading">
              <p>New experiment</p>
              <h2 id="new-experiment-heading">Name the work before it starts</h2>
            </div>
            <form onSubmit={submit}>
              <label>Experiment title
                <input
                  data-testid="experiment-title"
                  maxLength={120}
                  onChange={(event) => onFormChange({ ...form, title: event.target.value })}
                  placeholder="Cache layout under mixed load"
                  required
                  value={form.title}
                />
              </label>
              <label>Objective
                <textarea
                  data-testid="experiment-objective"
                  maxLength={1_000}
                  onChange={(event) => onFormChange({ ...form, objective: event.target.value })}
                  placeholder="What are you trying to determine?"
                  required
                  rows={4}
                  value={form.objective}
                />
              </label>
              <button className="primary-action sticky-submit" data-testid="create-experiment" disabled={busy} type="submit">
                {busy ? "Opening experiment…" : "Create experiment"}
              </button>
            </form>
            <p aria-live="polite" className="status-message" data-testid="list-message" role="status">{message}</p>
          </section>

          <section className="experiment-list" aria-labelledby="experiments-heading">
            <div className="section-heading">
              <p>Workspace</p>
              <h2 id="experiments-heading">Experiments</h2>
            </div>
            {experiments.length === 0 ? (
              <div className="empty-state" data-testid="empty-state">
                <strong>No experiments recorded yet.</strong>
                <p>Create an experiment, then add each observation while the work is happening.</p>
              </div>
            ) : (
              <div className="experiment-cards">
                {experiments.map((experiment) => (
                  <article key={experiment.id}>
                    <div>
                      <p>{formatDate(experiment.openedAt)} · {experiment.status}</p>
                      <h3>{experiment.title}</h3>
                      <span>{experiment.objective}</span>
                    </div>
                    <button data-testid={`open-experiment-${experiment.id}`} onClick={() => onOpen(experiment.id)} type="button">Open record</button>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="privacy-panel" aria-labelledby="privacy-heading">
            <p className="eyebrow">Storage and privacy</p>
            <h2 id="privacy-heading">What leaves this browser</h2>
            <p>Experiment text, hashes and receipts are stored in this project’s Cloudflare D1 database. A bearer workspace token stays in local storage. OpenTimestamps calendars receive only a SHA-256 digest, never the experiment text.</p>
          </section>

          <section className="faq" aria-labelledby="faq-heading">
            <p className="eyebrow">Before relying on the export</p>
            <h2 id="faq-heading">Common questions</h2>
            <details><summary>Does a timestamp make an activity eligible?</summary><p>No. It records a cryptographic commitment; it does not determine R&amp;DTI eligibility or prove the content is correct.</p></details>
            <details><summary>Can an entry be edited?</summary><p>No. The original remains unchanged. A correction is saved as a separately hashed, linked amendment.</p></details>
            <details><summary>Is a new receipt immediately confirmed by Bitcoin?</summary><p>No. Fresh receipts are pending calendar commitments. They need later upgrading and independent verification before any Bitcoin-attestation claim.</p></details>
          </section>
        </div>
      </main>

      <footer className="site-footer">
        <p>Solo-built support: I review GitHub issues and usually reply within a few days.</p>
        <a href="https://github.com/FishyDanny/ship72/issues">Ask for help</a>
        <a href="https://github.com/FishyDanny/ship72">Public source</a>
      </footer>
    </>
  );
}
