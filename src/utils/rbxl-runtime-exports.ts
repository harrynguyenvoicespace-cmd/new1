import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import {
  cleanupTempDir,
  createRbxlTempDir,
  runRbxlTool,
  sanitizeRbxlFileName,
  writeRuntimeJsonFile,
} from "@/utils/rbxl-bridge";

const EXPORTS_DIR = path.join(process.cwd(), ".runtime-rbxl-exports");

export type RuntimeExportRecord = {
  id: string;
  fileName: string;
  createdAt: string;
  nodeCount: number;
  byteLength: number;
};

export type RuntimeExportClientRecord = RuntimeExportRecord & {
  downloadUrl: string;
};

export function extractRuntimeDom(payload: unknown) {
  if (!payload || typeof payload !== "object") return payload;
  const body = payload as {
    snapshot?: unknown;
    dom?: unknown;
    runtimeDom?: unknown;
    runtimeDOM?: unknown;
  };

  return body.snapshot ?? body.dom ?? body.runtimeDom ?? body.runtimeDOM ?? payload;
}

export function runtimeExportFileName(fileName: string | undefined, runtimeDom: unknown) {
  const sourceName = runtimeDom && typeof runtimeDom === "object" ? runtimeDomSourceFileName(runtimeDom) : null;
  const base = fileName || sourceName || "runtime-place.rbxl";
  const sanitized = sanitizeRbxlFileName(base, "runtime-place.rbxl");
  return `${path.parse(sanitized).name}.rbxl`;
}

export async function createRuntimeExport(runtimeDom: unknown, fileName?: string): Promise<RuntimeExportRecord> {
  let tempDir = "";

  try {
    tempDir = await createRbxlTempDir();
    const inputPath = await writeRuntimeJsonFile(tempDir, runtimeDom);
    const outputName = runtimeExportFileName(fileName, runtimeDom);
    const outputPath = path.join(tempDir, outputName);

    await runRbxlTool(["from-json", inputPath, outputPath]);
    await fs.mkdir(EXPORTS_DIR, { recursive: true });

    const id = runtimeExportId();
    const finalPath = runtimeExportRbxlPath(id);
    await fs.copyFile(outputPath, finalPath);

    const stat = await fs.stat(finalPath);
    const record: RuntimeExportRecord = {
      id,
      fileName: outputName,
      createdAt: new Date().toISOString(),
      nodeCount: countRuntimeNodes(runtimeDom),
      byteLength: stat.size,
    };

    await fs.writeFile(runtimeExportMetaPath(id), JSON.stringify(record, null, 2), "utf8");
    return record;
  } finally {
    if (tempDir) {
      await cleanupTempDir(tempDir);
    }
  }
}

export async function listRuntimeExports(): Promise<RuntimeExportRecord[]> {
  try {
    await fs.mkdir(EXPORTS_DIR, { recursive: true });
    const entries = await fs.readdir(EXPORTS_DIR, { withFileTypes: true });
    const records = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
        .map(async (entry) => {
          try {
            const text = await fs.readFile(path.join(EXPORTS_DIR, entry.name), "utf8");
            return JSON.parse(text) as RuntimeExportRecord;
          } catch {
            return null;
          }
        }),
    );

    return records
      .filter((record): record is RuntimeExportRecord => Boolean(record))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  } catch {
    return [];
  }
}

export async function readRuntimeExport(id: string) {
  assertRuntimeExportId(id);
  const metaText = await fs.readFile(runtimeExportMetaPath(id), "utf8");
  const record = JSON.parse(metaText) as RuntimeExportRecord;
  const bytes = await fs.readFile(runtimeExportRbxlPath(id));
  return { record, bytes };
}

export function toRuntimeExportClientRecord(
  record: RuntimeExportRecord,
  origin = "",
): RuntimeExportClientRecord {
  return {
    ...record,
    downloadUrl: `${origin}/api/rbxl/runtime-exports?download=${encodeURIComponent(record.id)}`,
  };
}

function runtimeExportId() {
  const compactDate = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d+Z$/, "Z");
  return `${compactDate}-${randomUUID().slice(0, 8)}`;
}

function runtimeExportRbxlPath(id: string) {
  assertRuntimeExportId(id);
  return path.join(EXPORTS_DIR, `${id}.rbxl`);
}

function runtimeExportMetaPath(id: string) {
  assertRuntimeExportId(id);
  return path.join(EXPORTS_DIR, `${id}.json`);
}

function assertRuntimeExportId(id: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(id)) {
    throw new Error("Invalid runtime export id.");
  }
}

function runtimeDomSourceFileName(runtimeDom: object) {
  const source = "source" in runtimeDom ? runtimeDom.source : null;
  if (!source || typeof source !== "object" || !("fileName" in source)) return null;
  return typeof source.fileName === "string" ? source.fileName : null;
}

function countRuntimeNodes(runtimeDom: unknown) {
  if (!runtimeDom || typeof runtimeDom !== "object") return 0;
  const nodes = getRuntimeNodes(runtimeDom as Record<string, unknown>);
  if (Array.isArray(nodes)) return nodes.length;
  if (nodes && typeof nodes === "object") return Object.keys(nodes).length;
  return 0;
}

function getRuntimeNodes(runtimeDom: Record<string, unknown>) {
  return runtimeDom.nodes ?? runtimeDom.Nodes ?? runtimeDom.instances ?? runtimeDom.Instances;
}
