import { getAppTokens, PageShell } from "@ship72/ui";
import { useEffect, useState } from "react";
import {
  appendAmendment,
  appendEntry,
  createExperiment,
  ensureWorkspace,
  getExperiment,
  listExperiments,
  readExport,
  saveAnchors,
  type EntryInput,
  type ExperimentInput,
  type ExperimentSummary,
  type ExperimentView,
  type SubstantiationPack,
} from "./api";
import { ExperimentList } from "./experiment-list";
import { ExperimentWorkspace } from "./experiment-workspace";
import { anchorHashToCalendars, verifyEntryHash } from "./timestamps";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8787";

interface RouteMetadata {
  description: string;
  robots: string;
  title: string;
}

interface SerialisedPack {
  contents: string;
  filename: string;
}

const emptyExperimentForm: ExperimentInput = { objective: "", title: "" };

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function experimentIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/experiments\/([^/]+)\/?$/u);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export function getRouteMetadata(experimentId: string | null, title: string | null): RouteMetadata {
  return experimentId && title
    ? {
        description: "Private hash-linked experiment record in Rdlog.",
        robots: "noindex, nofollow",
        title: `${title} — private Rdlog experiment`,
      }
    : {
        description: "Record R&D experiments as they happen, hash-link every entry and export exact OpenTimestamps calendar receipts.",
        robots: "index, follow",
        title: "Rdlog — contemporaneous R&D experiment records",
      };
}

export function toDatetimeLocal(date: Date, timeZone?: string): string {
  const parts = new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes): string => parts.find((part) => part.type === type)?.value ?? "";
  return `${read("year")}-${read("month")}-${read("day")}T${read("hour")}:${read("minute")}`;
}

export function serialisePack(pack: SubstantiationPack): SerialisedPack {
  return {
    contents: JSON.stringify(pack, null, 2),
    filename: `rdlog-${pack.experiment.id}-${pack.exportedAt.slice(0, 10)}.json`,
  };
}

function triggerDownload(pack: SubstantiationPack): void {
  const serialised = serialisePack(pack);
  const url = URL.createObjectURL(new Blob([serialised.contents], { type: "application/json" }));
  const link = document.createElement("a");
  link.download = serialised.filename;
  link.href = url;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function setMeta(name: string, content: string): void {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.name = name;
    document.head.append(element);
  }
  element.content = content;
}

export function App() {
  const [amendmentBodies, setAmendmentBodies] = useState<Record<string, string | undefined>>({});
  const [busy, setBusy] = useState(false);
  const [entryForm, setEntryForm] = useState<EntryInput>(() => ({
    body: "",
    kind: "hypothesis",
    occurredAt: toDatetimeLocal(new Date()),
  }));
  const [experiment, setExperiment] = useState<ExperimentView | null>(null);
  const [experimentForm, setExperimentForm] = useState<ExperimentInput>(emptyExperimentForm);
  const [experiments, setExperiments] = useState<ExperimentSummary[]>([]);
  const [message, setMessage] = useState("Loading your browser workspace…");
  const [pack, setPack] = useState<SubstantiationPack | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    async function initialise(): Promise<void> {
      try {
        const workspaceToken = await ensureWorkspace(localStorage, fetch, apiUrl);
        if (!current) {
          return;
        }
        setToken(workspaceToken);
        const routeId = experimentIdFromPath(window.location.pathname);
        if (routeId) {
          const loaded = await getExperiment(fetch, apiUrl, workspaceToken, routeId);
          if (current) {
            setExperiment(loaded);
          }
        } else {
          const listed = await listExperiments(fetch, apiUrl, workspaceToken);
          if (current) {
            setExperiments(listed);
          }
        }
        if (current) {
          setMessage("");
        }
      } catch (error) {
        if (current) {
          setMessage(errorMessage(error, "The workspace could not be loaded."));
        }
      }
    }
    void initialise();
    return () => {
      current = false;
    };
  }, []);

  useEffect(() => {
    const metadata = getRouteMetadata(experiment?.id ?? null, experiment?.title ?? null);
    document.title = metadata.title;
    setMeta("description", metadata.description);
    setMeta("robots", metadata.robots);
  }, [experiment]);

  async function refreshExperiment(experimentId: string): Promise<ExperimentView> {
    if (!token) {
      throw new Error("The browser workspace is not ready yet.");
    }
    const refreshed = await getExperiment(fetch, apiUrl, token, experimentId);
    setExperiment(refreshed);
    return refreshed;
  }

  async function handleCreateExperiment(): Promise<void> {
    if (!token) {
      setMessage("Wait for the browser workspace to finish loading.");
      return;
    }
    setBusy(true);
    setMessage("Opening the experiment record…");
    try {
      const created = await createExperiment(fetch, apiUrl, token, experimentForm);
      setExperiment(created);
      setExperiments((current) => [created, ...current]);
      setExperimentForm(emptyExperimentForm);
      window.history.pushState({}, "", `/experiments/${encodeURIComponent(created.id)}`);
      setMessage("Experiment created. Record the hypothesis or first project note now.");
    } catch (error) {
      setMessage(errorMessage(error, "The experiment could not be created."));
    } finally {
      setBusy(false);
    }
  }

  async function handleOpen(experimentId: string): Promise<void> {
    if (!token) {
      return;
    }
    setBusy(true);
    setMessage("Opening experiment…");
    try {
      const loaded = await getExperiment(fetch, apiUrl, token, experimentId);
      setExperiment(loaded);
      setPack(null);
      window.history.pushState({}, "", `/experiments/${encodeURIComponent(experimentId)}`);
      setMessage("");
    } catch (error) {
      setMessage(errorMessage(error, "The experiment could not be opened."));
    } finally {
      setBusy(false);
    }
  }

  function handleBack(): void {
    setExperiment(null);
    setPack(null);
    setMessage("");
    window.history.pushState({}, "", "/");
  }

  async function anchorEntry(entryId: string): Promise<void> {
    if (!token || !experiment) {
      throw new Error("The experiment workspace is not ready.");
    }
    const entry = experiment.entries.find((candidate) => candidate.id === entryId);
    if (!entry) {
      throw new Error("The saved entry could not be found.");
    }
    if (!(await verifyEntryHash(entry))) {
      throw new Error("The saved entry does not match its SHA-256 digest; no calendar request was made.");
    }
    const anchors = await anchorHashToCalendars(entry.hash);
    await saveAnchors(fetch, apiUrl, token, entry.id, anchors);
  }

  async function handleRecord(): Promise<void> {
    if (!token || !experiment) {
      setMessage("The experiment workspace is not ready.");
      return;
    }
    setBusy(true);
    setMessage("Saving the immutable entry, checking its hash and contacting two calendars…");
    try {
      const created = await appendEntry(fetch, apiUrl, token, experiment.id, {
        ...entryForm,
        occurredAt: new Date(entryForm.occurredAt).toISOString(),
      });
      const verified = await verifyEntryHash(created);
      if (!verified) {
        throw new Error("The server hash did not match the browser’s canonical hash.");
      }
      setExperiment((current) => current ? {
        ...current,
        entries: [...current.entries, { ...created, amendments: [], anchors: [] }],
      } : current);
      setEntryForm((current) => ({ ...current, body: "", occurredAt: toDatetimeLocal(new Date()) }));
      try {
        const anchors = await anchorHashToCalendars(created.hash);
        await saveAnchors(fetch, apiUrl, token, created.id, anchors);
        await refreshExperiment(experiment.id);
        setMessage("Entry appended. Browser hash matched and two exact calendar receipts were stored.");
      } catch (anchorError) {
        await refreshExperiment(experiment.id);
        setMessage(`Entry appended and hash verified, but two-calendar anchoring is incomplete: ${errorMessage(anchorError, "calendar request failed")}`);
      }
    } catch (error) {
      setMessage(errorMessage(error, "The entry could not be recorded."));
    } finally {
      setBusy(false);
    }
  }

  async function handleRetryAnchor(entryId: string): Promise<void> {
    if (!experiment) {
      return;
    }
    setBusy(true);
    setMessage("Retrying both OpenTimestamps calendars…");
    try {
      await anchorEntry(entryId);
      await refreshExperiment(experiment.id);
      setMessage("Two exact calendar receipts were captured and stored.");
    } catch (error) {
      setMessage(errorMessage(error, "Both calendar receipts could not be captured."));
    } finally {
      setBusy(false);
    }
  }

  async function handleAmend(entryId: string): Promise<void> {
    if (!token || !experiment) {
      return;
    }
    const body = amendmentBodies[entryId]?.trim();
    if (!body) {
      return;
    }
    setBusy(true);
    setMessage("Appending the linked correction without changing the original…");
    try {
      await appendAmendment(fetch, apiUrl, token, entryId, body);
      setAmendmentBodies((current) => ({ ...current, [entryId]: "" }));
      await refreshExperiment(experiment.id);
      setMessage("Correction appended. The original record remains unchanged.");
    } catch (error) {
      setMessage(errorMessage(error, "The correction could not be appended."));
    } finally {
      setBusy(false);
    }
  }

  async function handleExport(): Promise<void> {
    if (!token || !experiment) {
      return;
    }
    setBusy(true);
    setMessage("Validating the chain and preparing the substantiation pack…");
    try {
      const createdPack = await readExport(fetch, apiUrl, token, experiment.id);
      setPack(createdPack);
      triggerDownload(createdPack);
      setMessage("Substantiation pack downloaded with the complete chain and stored receipts.");
    } catch (error) {
      setMessage(errorMessage(error, "The substantiation pack could not be prepared."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell className="app-shell" tokens={getAppTokens("rdlog")}>
      {experiment ? (
        <ExperimentWorkspace
          amendmentBodies={amendmentBodies}
          busy={busy}
          entryForm={entryForm}
          experiment={experiment}
          message={message}
          onAmend={(entryId) => void handleAmend(entryId)}
          onAmendmentChange={(entryId, body) => setAmendmentBodies((current) => ({ ...current, [entryId]: body }))}
          onBack={handleBack}
          onEntryChange={setEntryForm}
          onExport={() => void handleExport()}
          onRecord={() => void handleRecord()}
          onRetryAnchor={(entryId) => void handleRetryAnchor(entryId)}
          pack={pack}
        />
      ) : (
        <ExperimentList
          busy={busy}
          experiments={experiments}
          form={experimentForm}
          message={message}
          onCreate={() => void handleCreateExperiment()}
          onFormChange={setExperimentForm}
          onOpen={(experimentId) => void handleOpen(experimentId)}
        />
      )}
    </PageShell>
  );
}
