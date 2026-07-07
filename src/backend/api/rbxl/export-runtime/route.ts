import { promises as fs } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import {
  cleanupTempDir,
  createRbxlTempDir,
  runRbxlTool,
  sanitizeRbxlFileName,
  writeRuntimeJsonFile,
} from "@/utils/rbxl-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RuntimeExportRequest = {
  fileName?: string;
  snapshot?: unknown;
  dom?: unknown;
  runtimeDom?: unknown;
};

export async function POST(request: NextRequest) {
  let tempDir = "";

  try {
    const payload = (await request.json()) as RuntimeExportRequest | unknown;
    const body = payload && typeof payload === "object" ? (payload as RuntimeExportRequest) : {};
    const runtimeDom = body.snapshot ?? body.dom ?? body.runtimeDom ?? payload;

    if (!runtimeDom || typeof runtimeDom !== "object") {
      throw new Error("Missing runtime JSON DOM.");
    }

    tempDir = await createRbxlTempDir();
    const inputPath = await writeRuntimeJsonFile(tempDir, runtimeDom);
    const outputName = rbxlOutputName(body.fileName, runtimeDom);
    const outputPath = path.join(tempDir, outputName);

    await runRbxlTool(["from-json", inputPath, outputPath]);
    const bytes = await fs.readFile(outputPath);

    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${encodeHeaderFileName(outputName)}"`,
        "Content-Length": String(bytes.byteLength),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  } finally {
    if (tempDir) {
      await cleanupTempDir(tempDir);
    }
  }
}

function rbxlOutputName(fileName: string | undefined, runtimeDom: unknown) {
  const sourceName = runtimeDom && typeof runtimeDom === "object" ? runtimeDomSourceFileName(runtimeDom) : null;
  const base = fileName || sourceName || "runtime-place.rbxl";
  const sanitized = sanitizeRbxlFileName(base, "runtime-place.rbxl");
  return `${path.parse(sanitized).name}.rbxl`;
}

function runtimeDomSourceFileName(runtimeDom: object) {
  const source = "source" in runtimeDom ? runtimeDom.source : null;
  if (!source || typeof source !== "object" || !("fileName" in source)) return null;
  return typeof source.fileName === "string" ? source.fileName : null;
}

function encodeHeaderFileName(fileName: string) {
  return fileName.replace(/["\\]/g, "_");
}
