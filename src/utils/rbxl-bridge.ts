import { execFile as execFileCallback } from "child_process";
import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { promisify } from "util";

const execFile = promisify(execFileCallback);

export const RBXL_TOOL_PATH =
  process.env.RBXL_TOOL_PATH ||
  path.join(
    process.cwd(),
    "native",
    "rbxl_tool",
    "target",
    "debug",
    process.platform === "win32" ? "rbxl_tool.exe" : "rbxl_tool",
  );

const ROBLOX_EXTENSIONS = new Set([".rbxl", ".rbxlx", ".rbxm", ".rbxmx"]);

export type UploadedRbxlFile = {
  fileName: string;
  inputPath: string;
  tempDir: string;
};

export async function ensureRbxlTool() {
  try {
    await fs.access(RBXL_TOOL_PATH);
  } catch {
    throw new Error(`Rust helper not found at ${RBXL_TOOL_PATH}. Build it with: cargo build --manifest-path native/rbxl_tool/Cargo.toml`);
  }
}

export async function readUploadedRbxlFile(formData: FormData): Promise<UploadedRbxlFile> {
  const upload = formData.get("file");

  if (!upload || typeof upload === "string" || typeof upload.arrayBuffer !== "function") {
    throw new Error("Missing Roblox file upload.");
  }

  const fileName = sanitizeFileName(upload.name || "place.rbxlx");
  const extension = path.extname(fileName).toLowerCase();
  if (!ROBLOX_EXTENSIONS.has(extension)) {
    throw new Error("Use a .rbxl, .rbxlx, .rbxm, or .rbxmx file.");
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "rbxl-lab-"));
  const inputPath = path.join(tempDir, fileName);
  const bytes = Buffer.from(await upload.arrayBuffer());
  await fs.writeFile(inputPath, bytes);

  return { fileName, inputPath, tempDir };
}

export async function runRbxlTool(args: string[]) {
  await ensureRbxlTool();
  try {
    return await execFile(RBXL_TOOL_PATH, args, {
      maxBuffer: 64 * 1024 * 1024,
      windowsHide: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(message);
  }
}

export async function cleanupTempDir(tempDir: string) {
  await fs.rm(tempDir, { recursive: true, force: true });
}

export async function createRbxlTempDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), "rbxl-lab-"));
}

export async function writeRuntimeJsonFile(tempDir: string, payload: unknown) {
  const inputPath = path.join(tempDir, "runtime-dom.json");
  await fs.writeFile(inputPath, JSON.stringify(payload), "utf8");
  return inputPath;
}

export function sanitizeRbxlFileName(fileName: string, fallback = `${randomUUID()}.rbxl`) {
  const baseName = path.basename(fileName).replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_");
  return baseName || fallback;
}

function sanitizeFileName(fileName: string) {
  return sanitizeRbxlFileName(fileName, `${randomUUID()}.rbxlx`);
}
