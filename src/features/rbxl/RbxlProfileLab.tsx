"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Download,
  FileJson,
  FolderTree,
  Layers3,
  Loader2,
  RefreshCw,
  Save,
  Search,
  UploadCloud,
} from "lucide-react";
import { countClasses, filterTree, summarizeSnapshot } from "./model";
import type { RbxlSnapshot, RbxlSummary } from "./types";

type LabStatus = "Ready" | "Parsing" | "Exporting" | "Parsed" | "Error";
type LabTab = "Tree" | "Classes" | "Log";

type ParseSuccess = {
  ok: true;
  fileName: string;
  snapshot: RbxlSnapshot;
  summary: RbxlSummary;
  log: string;
};

type ApiError = {
  ok: false;
  error: string;
};

type RuntimeExportItem = {
  id: string;
  fileName: string;
  createdAt: string;
  nodeCount: number;
  byteLength: number;
  downloadUrl: string;
};

type RuntimeExportsSuccess = {
  ok: true;
  exports: RuntimeExportItem[];
};

type RuntimeExportCreateSuccess = {
  ok: true;
  export: RuntimeExportItem;
  fileName: string;
  profileUrl: string;
};

const ACCEPTED_EXTENSIONS = ".rbxl,.rbxlx,.rbxm,.rbxmx";

const STATUS_STYLES: Record<LabStatus, string> = {
  Ready: "border-black/10 bg-white text-[#3e454e]",
  Parsing: "border-[#2d9cdb]/30 bg-[#e8f6fd] text-[#13577a]",
  Exporting: "border-[#2d9cdb]/30 bg-[#e8f6fd] text-[#13577a]",
  Parsed: "border-[#39a66a]/30 bg-[#eaf8f0] text-[#19643c]",
  Error: "border-[#d94747]/30 bg-[#fff0f0] text-[#9f2c2c]",
};

export function RbxlProfileLab() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [snapshot, setSnapshot] = useState<RbxlSnapshot | null>(null);
  const [summary, setSummary] = useState<RbxlSummary | null>(null);
  const [status, setStatus] = useState<LabStatus>("Ready");
  const [activeTab, setActiveTab] = useState<LabTab>("Tree");
  const [query, setQuery] = useState("");
  const [log, setLog] = useState("Ready.");
  const [runtimeJsonText, setRuntimeJsonText] = useState("");
  const [runtimeExports, setRuntimeExports] = useState<RuntimeExportItem[]>([]);
  const [runtimeExportsLoading, setRuntimeExportsLoading] = useState(false);

  const visibleRows = useMemo(() => filterTree(snapshot, query), [snapshot, query]);
  const classCounts = useMemo(() => countClasses(snapshot), [snapshot]);
  const currentSummary = useMemo(() => {
    if (summary) return summary;
    return snapshot ? summarizeSnapshot(snapshot) : null;
  }, [snapshot, summary]);

  const busy = status === "Parsing" || status === "Exporting";
  const statItems = [
    { label: "Nodes", value: currentSummary?.nodeCount ?? 0, tone: "bg-[#ffd21f]" },
    { label: "MeshParts", value: currentSummary?.meshPartCount ?? 0, tone: "bg-[#37c6ab]" },
    { label: "Scripts", value: currentSummary?.scriptCount ?? 0, tone: "bg-[#f46b8f]" },
    { label: "Format", value: snapshot?.source.format ?? "-", tone: "bg-[#20242a]" },
  ];

  useEffect(() => {
    void loadRuntimeExports({ silent: true });
  }, []);

  async function loadRuntimeExports({ silent = false }: { silent?: boolean } = {}) {
    setRuntimeExportsLoading(true);

    try {
      const response = await fetch("/api/rbxl/runtime-exports", { cache: "no-store" });
      const payload = (await response.json()) as RuntimeExportsSuccess | ApiError;

      if (!response.ok || !payload.ok) {
        throw new Error(payload.ok ? `Load failed with HTTP ${response.status}.` : payload.error);
      }

      setRuntimeExports(payload.exports);
      if (!silent) {
        setLog((previous) => `${previous}\nLoaded ${payload.exports.length} runtime export(s).`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!silent) {
        setStatus("Error");
        setLog((previous) => `${previous}\n${message}`);
      }
    } finally {
      setRuntimeExportsLoading(false);
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setSnapshot(null);
    setSummary(null);
    setQuery("");
    setStatus("Ready");
    setActiveTab("Tree");
    setLog(file ? `Selected ${file.name} (${formatBytes(file.size)}).` : "Ready.");
  }

  async function handleParse() {
    if (!selectedFile) {
      setStatus("Error");
      setLog("No Roblox file selected.");
      return;
    }

    setStatus("Parsing");
    setLog(`Parsing ${selectedFile.name}...`);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch("/api/rbxl/parse", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as ParseSuccess | ApiError;

      if (!response.ok || !payload.ok) {
        throw new Error(payload.ok ? `Parse failed with HTTP ${response.status}.` : payload.error);
      }

      setSnapshot(payload.snapshot);
      setSummary(payload.summary);
      setStatus("Parsed");
      setActiveTab("Tree");
      setLog([`Parsed ${payload.fileName}.`, payload.log].filter(Boolean).join("\n"));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus("Error");
      setLog(message);
    }
  }

  async function handleSave() {
    if (!selectedFile) {
      setStatus("Error");
      setLog("No Roblox file selected.");
      return;
    }

    setLog((previous) => `${previous}\nSaving ${selectedFile.name} as .rbxl...`);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch("/api/rbxl/save", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as ApiError | null;
        throw new Error(payload?.error ?? `Save failed with HTTP ${response.status}.`);
      }

      const blob = await response.blob();
      const fileName = headerFileName(response.headers.get("Content-Disposition")) ?? rbxlFileName(selectedFile.name);
      downloadBlob(blob, fileName);
      setLog((previous) => `${previous}\nSaved ${fileName}.`);
      setStatus(snapshot ? "Parsed" : "Ready");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus("Error");
      setLog((previous) => `${previous}\n${message}`);
    }
  }

  async function handleExportRuntimeJson() {
    const trimmed = runtimeJsonText.trim();
    if (!trimmed) {
      setStatus("Error");
      setLog("Runtime JSON is empty.");
      return;
    }

    setStatus("Exporting");
    setLog("Exporting runtime JSON as binary .rbxl...");

    try {
      const runtimeDom = JSON.parse(trimmed) as unknown;
      const response = await fetch("/api/rbxl/runtime-exports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: runtimeJsonFileName(runtimeDom),
          snapshot: runtimeDom,
        }),
      });
      const payload = (await response.json()) as RuntimeExportCreateSuccess | ApiError;

      if (!response.ok || !payload.ok) {
        throw new Error(payload.ok ? `Runtime export failed with HTTP ${response.status}.` : payload.error);
      }

      downloadFromUrl(payload.export.downloadUrl, payload.export.fileName);
      setRuntimeExports((previous) => [payload.export, ...previous.filter((item) => item.id !== payload.export.id)]);
      setStatus(snapshot ? "Parsed" : "Ready");
      setLog((previous) => `${previous}\nExported ${payload.export.fileName}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus("Error");
      setLog(message);
    }
  }

  function handleDownloadJson() {
    if (!snapshot) return;

    const jsonText = JSON.stringify(snapshot, null, 2);
    const fileName = `${stripExtension(snapshot.source.fileName)}.snapshot.json`;
    downloadBlob(new Blob([jsonText], { type: "application/json" }), fileName);
    setLog((previous) => `${previous}\nDownloaded ${fileName}.`);
  }

  return (
    <main className="min-h-screen bg-[#f3f2ee] text-[#17181c]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-black/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#717783]">Profile</p>
            <h1 className="mt-2 text-3xl font-black leading-tight sm:text-4xl">RBXL Lab</h1>
          </div>
          <div className={`inline-flex h-10 w-fit items-center gap-2 rounded-lg border px-3 text-sm font-bold ${STATUS_STYLES[status]}`}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {status}
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
          <label className="flex min-h-[124px] cursor-pointer items-center gap-4 rounded-lg border border-dashed border-black/20 bg-white p-4 shadow-[0_16px_44px_rgba(36,40,45,0.08)] transition hover:border-black/40">
            <input ref={inputRef} className="sr-only" type="file" accept={ACCEPTED_EXTENSIONS} onChange={handleFileChange} />
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-[#20242a] text-white">
              <UploadCloud className="h-6 w-6" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-base font-black">{selectedFile?.name ?? "Select Roblox file"}</span>
              <span className="mt-1 block text-sm font-medium text-[#717783]">
                {selectedFile ? formatBytes(selectedFile.size) : ".rbxl .rbxlx .rbxm .rbxmx"}
              </span>
            </span>
          </label>

          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
            <ActionButton disabled={!selectedFile || busy} onClick={handleParse} icon={busy ? Loader2 : UploadCloud} spin={busy}>
              Parse
            </ActionButton>
            <ActionButton disabled={!selectedFile || busy} onClick={handleSave} icon={Save}>
              Save .rbxl
            </ActionButton>
            <ActionButton disabled={!snapshot || busy} onClick={handleDownloadJson} icon={FileJson}>
              Download JSON
            </ActionButton>
          </div>
        </section>

        <section className="grid gap-3 rounded-lg border border-black/10 bg-white p-4 shadow-[0_16px_44px_rgba(36,40,45,0.08)]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#ffd21f] text-[#20242a]">
                <FileJson className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-base font-black">Runtime JSON</h2>
                <p className="mt-0.5 text-sm font-medium text-[#717783]">POST target: /api/rbxl/export-runtime</p>
              </div>
            </div>
            <ActionButton disabled={!runtimeJsonText.trim() || busy} onClick={handleExportRuntimeJson} icon={status === "Exporting" ? Loader2 : Save} spin={status === "Exporting"}>
              Export .rbxl
            </ActionButton>
          </div>
          <textarea
            value={runtimeJsonText}
            onChange={(event) => setRuntimeJsonText(event.target.value)}
            className="min-h-[150px] w-full resize-y rounded-lg border border-black/10 bg-[#f8f7f4] p-3 font-mono text-xs leading-5 outline-none transition focus:border-[#20242a]"
            placeholder='{"schema":"bloxlab.robloxDom.v1","rootId":"...","nodes":{...}}'
          />
          <div className="rounded-lg border border-black/10 bg-[#f8f7f4]">
            <div className="flex items-center justify-between gap-3 border-b border-black/10 p-3">
              <div>
                <h3 className="text-sm font-black">Runtime exports</h3>
                <p className="mt-0.5 text-xs font-semibold text-[#717783]">Roblox toolbar sends will appear here.</p>
              </div>
              <button
                type="button"
                onClick={() => void loadRuntimeExports()}
                disabled={runtimeExportsLoading}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-white px-3 text-xs font-black text-[#20242a] shadow-sm transition hover:bg-[#eeece6] disabled:text-[#858b94]"
              >
                <RefreshCw className={`h-4 w-4 ${runtimeExportsLoading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
            {runtimeExports.length === 0 ? (
              <div className="p-3 text-sm font-semibold text-[#717783]">
                No runtime RBXL yet. Press the Roblox toolbar button, then refresh this list.
              </div>
            ) : (
              <div className="divide-y divide-black/10">
                {runtimeExports.map((item) => (
                  <div key={item.id} className="grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-[#20242a]">{item.fileName}</p>
                      <p className="mt-1 text-xs font-semibold text-[#717783]">
                        {formatDateTime(item.createdAt)} · {item.nodeCount} nodes · {formatBytes(item.byteLength)}
                      </p>
                    </div>
                    <a
                      href={item.downloadUrl}
                      download={item.fileName}
                      className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[#20242a] px-3 text-xs font-black text-white transition hover:bg-black"
                    >
                      <Download className="h-4 w-4" />
                      Download
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {statItems.map((item) => (
            <div key={item.label} className="rounded-lg border border-black/10 bg-white p-4 shadow-[0_12px_32px_rgba(36,40,45,0.06)]">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-bold uppercase tracking-[0.13em] text-[#717783]">{item.label}</span>
                <span className={`h-2.5 w-2.5 rounded-full ${item.tone}`} />
              </div>
              <strong className="mt-3 block truncate text-2xl font-black">{item.value}</strong>
            </div>
          ))}
        </section>

        <section className="min-h-[560px] rounded-lg border border-black/10 bg-white shadow-[0_18px_52px_rgba(36,40,45,0.09)]">
          <div className="flex flex-col gap-3 border-b border-black/10 p-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex gap-2 overflow-x-auto">
              {(["Tree", "Classes", "Log"] as LabTab[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-black transition ${
                    activeTab === tab ? "bg-[#20242a] text-white" : "bg-[#f4f3f0] text-[#4d545e] hover:bg-[#ebe9e3]"
                  }`}
                >
                  {tab === "Tree" ? <FolderTree className="h-4 w-4" /> : tab === "Classes" ? <Layers3 className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                  {tab}
                </button>
              ))}
            </div>

            {activeTab === "Tree" ? (
              <label className="relative block w-full lg:max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#717783]" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="h-10 w-full rounded-lg border border-black/10 bg-[#f8f7f4] pl-9 pr-3 text-sm font-semibold outline-none transition focus:border-[#20242a]"
                  placeholder="Search tree"
                />
              </label>
            ) : null}
          </div>

          <div className="p-3">
            {activeTab === "Tree" ? (
              <TreeView rows={visibleRows} hasSnapshot={Boolean(snapshot)} />
            ) : activeTab === "Classes" ? (
              <ClassesView classCounts={classCounts} />
            ) : (
              <pre className="max-h-[520px] overflow-auto whitespace-pre-wrap rounded-lg bg-[#17181c] p-4 font-mono text-sm leading-6 text-[#e9edf2]">
                {log || "Ready."}
              </pre>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function ActionButton({
  children,
  disabled,
  icon: Icon,
  onClick,
  spin = false,
}: {
  children: string;
  disabled?: boolean;
  icon: typeof UploadCloud;
  onClick: () => void;
  spin?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#20242a] px-4 text-sm font-black text-white transition hover:bg-black disabled:cursor-not-allowed disabled:bg-[#d8d6cf] disabled:text-[#858b94]"
    >
      <Icon className={`h-4 w-4 ${spin ? "animate-spin" : ""}`} />
      {children}
    </button>
  );
}

function TreeView({ rows, hasSnapshot }: { rows: ReturnType<typeof filterTree>; hasSnapshot: boolean }) {
  if (!hasSnapshot) {
    return <EmptyState title="No snapshot loaded" detail="Select a Roblox file and parse it." />;
  }

  if (rows.length === 0) {
    return <EmptyState title="No matches" detail="Try another name or class." />;
  }

  return (
    <div className="max-h-[520px] overflow-auto rounded-lg border border-black/10">
      {rows.map((row) => (
        <div key={row.id} className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-black/10 px-3 py-2.5 last:border-b-0 ${row.isMatch ? "bg-[#fff8d8]" : "bg-white"}`}>
          <div className="min-w-0" style={{ paddingLeft: `${Math.min(row.depth, 12) * 18}px` }}>
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-sm font-black">{row.node.Name || "(unnamed)"}</span>
              <span className="shrink-0 rounded bg-[#eef0ef] px-2 py-0.5 text-xs font-bold text-[#4d545e]">{row.node.ClassName}</span>
            </div>
            <p className="mt-1 truncate font-mono text-xs text-[#858b94]">{row.id}</p>
          </div>
          <span className="rounded bg-[#f4f3f0] px-2 py-1 text-xs font-black text-[#4d545e]">{row.childCount}</span>
        </div>
      ))}
    </div>
  );
}

function ClassesView({ classCounts }: { classCounts: ReturnType<typeof countClasses> }) {
  if (classCounts.length === 0) {
    return <EmptyState title="No classes yet" detail="Parsed class counts will appear here." />;
  }

  const maxCount = classCounts[0]?.count ?? 1;

  return (
    <div className="grid max-h-[520px] gap-2 overflow-auto">
      {classCounts.map((item) => (
        <div key={item.className} className="grid gap-2 rounded-lg border border-black/10 bg-white p-3">
          <div className="flex items-center justify-between gap-3">
            <span className="truncate text-sm font-black">{item.className}</span>
            <span className="text-sm font-black text-[#4d545e]">{item.count}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[#eef0ef]">
            <div className="h-full rounded-full bg-[#37c6ab]" style={{ width: `${Math.max(4, (item.count / maxCount) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="grid min-h-[320px] place-items-center rounded-lg border border-dashed border-black/10 bg-[#f8f7f4] p-6 text-center">
      <div>
        <p className="text-base font-black">{title}</p>
        <p className="mt-1 text-sm font-medium text-[#717783]">{detail}</p>
      </div>
    </div>
  );
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function downloadFromUrl(url: string, fileName: string) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

function headerFileName(header: string | null) {
  const match = header?.match(/filename="([^"]+)"/i);
  return match?.[1] ?? null;
}

function rbxlFileName(fileName: string) {
  return `${stripExtension(fileName)}.rbxl`;
}

function runtimeJsonFileName(value: unknown) {
  if (!value || typeof value !== "object") return "runtime-place.rbxl";
  const source = "source" in value ? value.source : null;
  if (!source || typeof source !== "object" || !("fileName" in source)) return "runtime-place.rbxl";
  return typeof source.fileName === "string" ? rbxlFileName(source.fileName) : "runtime-place.rbxl";
}

function stripExtension(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "") || "place";
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}
