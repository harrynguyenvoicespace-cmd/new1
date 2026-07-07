import { NextRequest, NextResponse } from "next/server";
import {
  createRuntimeExport,
  extractRuntimeDom,
  listRuntimeExports,
  readRuntimeExport,
  runtimeExportFileName,
  toRuntimeExportClientRecord,
} from "@/utils/rbxl-runtime-exports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RuntimeExportRequest = {
  fileName?: string;
  snapshot?: unknown;
  dom?: unknown;
  runtimeDom?: unknown;
  runtimeDOM?: unknown;
};

export async function GET(request: NextRequest) {
  const downloadId = request.nextUrl.searchParams.get("download");

  if (downloadId) {
    try {
      const { record, bytes } = await readRuntimeExport(downloadId);
      return new NextResponse(new Uint8Array(bytes), {
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Disposition": `attachment; filename="${encodeHeaderFileName(record.fileName)}"`,
          "Content-Length": String(bytes.byteLength),
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return NextResponse.json({ ok: false, error: message }, { status: 404 });
    }
  }

  const exports = await listRuntimeExports();
  return NextResponse.json({
    ok: true,
    exports: exports.map((record) => toRuntimeExportClientRecord(record)),
  });
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as RuntimeExportRequest | unknown;
    const body = payload && typeof payload === "object" ? (payload as RuntimeExportRequest) : {};
    const runtimeDom = extractRuntimeDom(payload);

    if (!runtimeDom || typeof runtimeDom !== "object") {
      throw new Error("Missing runtime JSON DOM.");
    }

    const record = await createRuntimeExport(runtimeDom, body.fileName);
    const origin = requestOrigin(request);

    return NextResponse.json({
      ok: true,
      export: toRuntimeExportClientRecord(record, origin),
      fileName: runtimeExportFileName(body.fileName, runtimeDom),
      profileUrl: `${origin}/profile`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

function encodeHeaderFileName(fileName: string) {
  return fileName.replace(/["\\]/g, "_");
}

function requestOrigin(request: NextRequest) {
  const protocol = request.headers.get("x-forwarded-proto") || request.nextUrl.protocol.replace(":", "") || "http";
  const host = request.headers.get("host") || request.nextUrl.host;

  if (host && !host.startsWith("0.0.0.0")) {
    return `${protocol}://${host}`;
  }

  const port = request.nextUrl.port || "8080";
  return `${protocol}://127.0.0.1:${port}`;
}
