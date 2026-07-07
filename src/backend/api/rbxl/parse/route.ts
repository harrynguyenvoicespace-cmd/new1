import { promises as fs } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { summarizeSnapshot } from "@/features/rbxl/model";
import type { RbxlSnapshot } from "@/features/rbxl/types";
import { cleanupTempDir, readUploadedRbxlFile, runRbxlTool } from "@/utils/rbxl-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let tempDir = "";

  try {
    const uploaded = await readUploadedRbxlFile(await request.formData());
    tempDir = uploaded.tempDir;

    const snapshotPath = path.join(uploaded.tempDir, "snapshot.json");
    const result = await runRbxlTool(["parse", uploaded.inputPath, snapshotPath]);
    const snapshotText = await fs.readFile(snapshotPath, "utf8");
    const snapshot = JSON.parse(snapshotText) as RbxlSnapshot;
    const summary = summarizeSnapshot(snapshot);

    return NextResponse.json({
      ok: true,
      fileName: uploaded.fileName,
      snapshot,
      summary,
      log: [result.stdout, result.stderr].filter(Boolean).join("\n").trim(),
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
