import { promises as fs } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { cleanupTempDir, readUploadedRbxlFile, runRbxlTool } from "@/utils/rbxl-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let tempDir = "";

  try {
    const uploaded = await readUploadedRbxlFile(await request.formData());
    tempDir = uploaded.tempDir;

    const outputName = `${path.parse(uploaded.fileName).name}.rbxl`;
    const outputPath = path.join(uploaded.tempDir, outputName);
    await runRbxlTool(["save-rbxl", uploaded.inputPath, outputPath]);
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

function encodeHeaderFileName(fileName: string) {
  return fileName.replace(/["\\]/g, "_");
}
