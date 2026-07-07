"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, BadgeCheck, Box, Boxes, ChevronDown, CircleDot, ClipboardList, CloudSun, Cuboid, Download, FileArchive, FileBox, Grid3X3, Image as ImageIcon, ImagePlus, KeyRound, Layers3, Loader2, Palette, Play, Scissors, ShieldCheck, Sparkles, SplitSquareHorizontal, Type, Upload, Wand2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { importGLTFFile, type ImportSummary } from "@/utils/gltf-importer";
import { useGeometryStore } from "@/stores/geometry-store";
import { useSceneStore } from "@/stores/scene-store";
import { useSelectionStore } from "@/stores/selection-store";
import { useViewportStore } from "@/stores/viewport-store";
import { useGeneratedModelsStore } from "@/stores/generated-models-store";
import { Euler, Matrix4, Quaternion, Vector3 } from "three";
import type { SkyboxFaceName, SkyboxFaces } from "@/types/geometry";
import { studioApiRoot } from "@/frontend/pages/studio/lib/api-root";
import styles from "./tripo-panel.module.css";

type Group = "generate" | "image" | "skybox" | "models" | "mesh" | "animation" | "hymotion" | "opencloud" | "roblox" | "common";
type Kind = "text" | "textarea" | "number" | "select" | "boolean" | "multiline";
type Value = string | number | boolean | undefined;
type Form = Record<string, Value>;
type Field = { name: string; label: string; kind: Kind; def?: Value; placeholder?: string; options?: { label: string; value: string }[]; min?: number; max?: number; step?: number; show?: (form: Form) => boolean };
type Op = { id: string; group: Group; label: string; endpoint: string; desc: string; icon: LucideIcon; output: "model" | "image" | "skybox" | "multiview" | "splat" | "json" | "task"; upload?: "image" | "model" | "multiview" | "none"; fields: Field[] };
type Link = { label: string; url: string; kind: "model" | "image" | "file"; key: string };
type History = { id: string; label: string; status: string };
type RobloxReport = { status?: string; can_upload_candidate?: boolean; issues?: Array<{ severity: string; code: string; label: string; message: string; value?: string | number; limit?: string | number }>; stats?: Record<string, unknown>; note?: string };
type SkyboxUpload = { file: File; url: string };

const modelOptions = ["P1-20260311", "v3.1-20260211", "v3.0-20250812", "v2.5-20250123"].map((value) => ({ label: value, value }));
const textureQualityOptions = ["standard", "detailed", "extreme"].map((value) => ({ label: value, value }));
const isP = (form: Form) => String(form.model || "").startsWith("P1");
const notP = (form: Form) => !isP(form);
const textureVisible = (form: Form) => !isP(form) || form.texture === true;
const source = (label = "Input source"): Field => ({ name: "input", label, kind: "text", placeholder: "file_token, task_id, or https:// URL" });
const common: Field[] = [
  { name: "model", label: "Model", kind: "select", def: "P1-20260311", options: modelOptions },
  { name: "face_limit", label: "Face limit", kind: "number", def: 5000, min: 48, max: 200000, step: 100 },
  { name: "texture", label: "Texture", kind: "boolean", def: false },
  { name: "pbr", label: "PBR", kind: "boolean", def: false, show: textureVisible },
  { name: "model_seed", label: "Model seed", kind: "number", placeholder: "Random" },
  { name: "texture_seed", label: "Texture seed", kind: "number", placeholder: "Random", show: textureVisible },
  { name: "texture_quality", label: "Texture quality", kind: "select", def: "standard", options: textureQualityOptions, show: textureVisible },
  { name: "geometry_quality", label: "Geometry quality", kind: "select", def: "standard", options: ["standard", "detailed"].map((value) => ({ label: value, value })), show: notP },
  { name: "auto_size", label: "Auto size", kind: "boolean", def: false, show: notP },
  { name: "quad", label: "Quad mesh", kind: "boolean", def: false, show: notP },
  { name: "smart_low_poly", label: "Smart low poly", kind: "boolean", def: false, show: notP },
  { name: "generate_parts", label: "Generate parts", kind: "boolean", def: false, show: notP },
  { name: "compress", label: "Compression", kind: "select", def: "", options: [{ label: "None", value: "" }, { label: "Geometry meshopt", value: "geometry" }], show: notP },
  { name: "export_uv", label: "Export UV", kind: "boolean", def: true, show: textureVisible },
];
const imgModels = ["seedream_v5", "seedream_v4"].map((value) => ({ label: value, value }));
const templates = ["", "asset_extraction", "character_completion", "t_pose", "head_extraction", "3d_enhance", "variants", "print_clay", "figure"].map((value) => ({ label: value || "None", value }));
const skyboxFaces = ["front", "back", "left", "right", "up", "down"] as const satisfies readonly SkyboxFaceName[];
const skyboxFaceLabel: Record<SkyboxFaceName, string> = {
  front: "front",
  back: "back",
  left: "left",
  right: "right",
  up: "top",
  down: "bottom",
};

const ops: Op[] = [
  { id: "text-to-model", group: "generate", label: "Text to Model", endpoint: "/tripo/generation/text-to-model", desc: "Prompt to textured 3D asset", icon: Type, output: "model", upload: "none", fields: [{ name: "prompt", label: "Prompt", kind: "textarea", def: "white anime hair accessory for a Roblox R6 avatar" }, { name: "negative_prompt", label: "Negative prompt", kind: "textarea", show: notP }, { name: "image_seed", label: "Image seed", kind: "number", placeholder: "Random", show: notP }, ...common] },
  { id: "image-to-model", group: "generate", label: "Image to Model", endpoint: "/tripo/generation/image-to-model", desc: "Single image to 3D asset", icon: ImagePlus, output: "model", upload: "image", fields: [source("Image input"), { name: "enable_image_autofix", label: "Image autofix", kind: "boolean", def: true, show: notP }, { name: "texture_alignment", label: "Texture alignment", kind: "select", def: "original_image", options: [{ label: "Original image", value: "original_image" }, { label: "Geometry", value: "geometry" }], show: textureVisible }, ...common] },
  { id: "multiview-to-model", group: "generate", label: "Multiview to Model", endpoint: "/tripo/generation/multiview-to-model", desc: "Front, side, back images to 3D", icon: Grid3X3, output: "model", upload: "multiview", fields: [{ name: "original_task_id", label: "Original multiview task", kind: "text" }, ...common] },
  { id: "image-to-splat", group: "generate", label: "Image to Splat", endpoint: "/tripo/generation/image-to-splat", desc: "Gaussian splat output", icon: CircleDot, output: "splat", upload: "image", fields: [source("Image input")] },
  { id: "text-to-image", group: "image", label: "Text to Image", endpoint: "/tripo/generation/text-to-image", desc: "Prompt to image", icon: Sparkles, output: "image", upload: "none", fields: [{ name: "prompt", label: "Prompt", kind: "textarea", def: "front view of a Roblox UGC hair asset on a clean background" }, { name: "model", label: "Image model", kind: "select", def: "seedream_v4", options: imgModels }, { name: "template", label: "Template", kind: "select", def: "", options: templates }, { name: "t_pose", label: "T-pose", kind: "boolean", def: false }, { name: "sketch_to_render", label: "Sketch to render", kind: "boolean", def: false }] },
  { id: "image-to-image", group: "image", label: "Image to Image", endpoint: "/tripo/generation/image-to-image", desc: "Edit image with prompt/template", icon: Wand2, output: "image", upload: "image", fields: [source("Primary image"), { name: "inputs_text", label: "Extra images", kind: "multiline", placeholder: "One URL/token per line" }, { name: "prompt", label: "Instruction", kind: "textarea" }, { name: "model", label: "Image model", kind: "select", def: "seedream_v5", options: imgModels }, { name: "template", label: "Template", kind: "select", def: "", options: templates }] },
  { id: "image-to-multiview", group: "image", label: "Image to Multiview", endpoint: "/tripo/generation/image-to-multiview", desc: "Single image to four views", icon: SplitSquareHorizontal, output: "multiview", upload: "image", fields: [source("Source image")] },
  { id: "edit-multiview", group: "image", label: "Edit Multiview", endpoint: "/tripo/generation/edit-multiview", desc: "Refine a multiview sheet", icon: ImageIcon, output: "multiview", upload: "image", fields: [source("Multiview image")] },
  { id: "skybox-upload", group: "skybox", label: "Upload Skybox", endpoint: "", desc: "Offline 6 image cube map", icon: Upload, output: "skybox", upload: "none", fields: [] },
  { id: "skybox-generate", group: "skybox", label: "Create Skybox", endpoint: "/tripo/generation/text-to-image", desc: "6 images to live skybox", icon: CloudSun, output: "skybox", upload: "none", fields: [{ name: "prompt", label: "Skybox prompt", kind: "textarea", def: "soft Roblox lobby sky with warm clouds, clean horizon, bright studio lighting" }, { name: "model", label: "Image model", kind: "select", def: "seedream_v5", options: imgModels }, { name: "template", label: "Template", kind: "select", def: "", options: templates }] },
  { id: "texture", group: "models", label: "Texture", endpoint: "/tripo/models/texture", desc: "Retexture a model", icon: Palette, output: "model", upload: "model", fields: [source("Model input"), { name: "model", label: "Texture model", kind: "text" }, { name: "texture_seed", label: "Texture seed", kind: "number" }, { name: "texture_quality", label: "Texture quality", kind: "select", def: "standard", options: textureQualityOptions }, { name: "pbr", label: "PBR", kind: "boolean", def: true }] },
  { id: "import-model", group: "models", label: "Import Model", endpoint: "/tripo/models/import", desc: "Import uploaded model", icon: FileBox, output: "task", upload: "model", fields: [source("Model file")] },
  { id: "convert", group: "models", label: "Convert Format", endpoint: "/tripo/models/convert", desc: "Convert and optimize model output", icon: FileArchive, output: "model", upload: "model", fields: [source("Model input"), { name: "format", label: "Format", kind: "select", def: "GLTF", options: ["GLTF", "USDZ", "FBX", "OBJ", "STL", "3MF"].map((value) => ({ label: value, value })) }, { name: "quad", label: "Quad remesh", kind: "boolean", def: false }, { name: "force_symmetry", label: "Force symmetry", kind: "boolean", def: false }, { name: "face_limit", label: "Face limit", kind: "number", def: 5000 }, { name: "texture_size", label: "Texture size", kind: "number", def: 2048 }, { name: "bake", label: "Bake textures", kind: "boolean", def: true }, { name: "pack_uv", label: "Pack UV", kind: "boolean", def: false }, { name: "scale_factor", label: "Scale factor", kind: "number", def: 1 }, { name: "with_animation", label: "With animation", kind: "boolean", def: true }, { name: "animate_in_place", label: "Animate in place", kind: "boolean", def: false }, { name: "part_names_text", label: "Part names", kind: "multiline" }] },
  { id: "segment", group: "mesh", label: "Segmentation", endpoint: "/tripo/mesh/segment", desc: "Split model into parts", icon: Layers3, output: "json", upload: "model", fields: [source("Model input"), { name: "model", label: "Segmentation model", kind: "text" }] },
  { id: "complete", group: "mesh", label: "Mesh Complete", endpoint: "/tripo/mesh/complete", desc: "Complete segmented parts", icon: Boxes, output: "model", upload: "none", fields: [source("Segment task"), { name: "model", label: "Completion model", kind: "text" }, { name: "part_names_text", label: "Part names", kind: "multiline" }] },
  { id: "decimate", group: "mesh", label: "Retopology", endpoint: "/tripo/mesh/decimate", desc: "High poly to low poly", icon: Scissors, output: "model", upload: "model", fields: [source("Model input"), { name: "model", label: "Decimation model", kind: "text" }, { name: "face_limit", label: "Face limit", kind: "number", def: 5000 }, { name: "quad", label: "Quad mesh", kind: "boolean", def: false }, { name: "part_names_text", label: "Part names", kind: "multiline" }, { name: "bake", label: "Bake textures", kind: "boolean", def: true }] },
  { id: "rig-check", group: "animation", label: "Rig Check", endpoint: "/tripo/animations/rig-check", desc: "Check recommended rig", icon: ShieldCheck, output: "json", upload: "model", fields: [source("Model input")] },
  { id: "rig", group: "animation", label: "Auto Rig", endpoint: "/tripo/animations/rig", desc: "Add skeleton rig", icon: Activity, output: "model", upload: "model", fields: [source("Model input"), { name: "model", label: "Rig model", kind: "select", def: "rig-v2.0", options: ["rig-v2.0", "rig-v1.0"].map((value) => ({ label: value, value })) }, { name: "rig_type", label: "Rig type", kind: "select", def: "biped", options: ["biped", "quadruped", "hexapod", "octopod", "avian", "serpentine", "aquatic"].map((value) => ({ label: value, value })) }, { name: "spec", label: "Spec", kind: "select", def: "mixamo", options: ["mixamo", "tripo"].map((value) => ({ label: value, value })) }, { name: "out_format", label: "Output format", kind: "select", def: "glb", options: ["glb", "fbx"].map((value) => ({ label: value.toUpperCase(), value })) }] },
  { id: "retarget", group: "animation", label: "Retarget", endpoint: "/tripo/animations/retarget", desc: "Apply preset animations", icon: Play, output: "model", upload: "none", fields: [source("Rigged task"), { name: "animation_mode", label: "Animation mode", kind: "select", def: "single", options: [{ label: "Single", value: "single" }, { label: "Multiple", value: "multiple" }] }, { name: "animation", label: "Animation", kind: "text", def: "preset:walk", show: (form) => form.animation_mode !== "multiple" }, { name: "animations_text", label: "Animations", kind: "multiline", def: "preset:walk\npreset:idle\npreset:run", show: (form) => form.animation_mode === "multiple" }, { name: "out_format", label: "Output format", kind: "select", def: "glb", options: ["glb", "fbx"].map((value) => ({ label: value.toUpperCase(), value })) }, { name: "bake_animation", label: "Bake animation", kind: "boolean", def: true }, { name: "export_with_geometry", label: "Export geometry", kind: "boolean", def: true }, { name: "animate_in_place", label: "In-place", kind: "boolean", def: false }] },
  { id: "hymotion-rbxm", group: "hymotion", label: "Text to Mixamo", endpoint: "/hymotion/generate", desc: "HY-Motion to Mixamo/Roblox animation", icon: Activity, output: "model", upload: "none", fields: [{ name: "prompt", label: "Motion prompt", kind: "textarea", def: "a Roblox character waves hello" }, { name: "format", label: "Output format", kind: "select", def: "glb", options: [{ label: "Mixamo GLB", value: "glb" }, { label: "Mixamo FBX", value: "fbx" }, { label: "Mixamo BVH", value: "bvh" }, { label: "Roblox RBXMX", value: "rbxmx" }, { label: "Roblox RBXM", value: "rbxm" }, { label: "glTF", value: "gltf" }] }, { name: "duration", label: "Duration", kind: "number", def: 3, min: 0.5, max: 12, step: 0.5 }, { name: "cfg_scale", label: "CFG scale", kind: "number", def: 5, min: 1, max: 10, step: 0.1 }, { name: "seed", label: "Seed", kind: "number" }, { name: "zero_root_xz", label: "In-place root", kind: "boolean", def: true }, { name: "loop", label: "Loop", kind: "boolean", def: false }, { name: "scale", label: "Position scale", kind: "number", def: 1 }] },
  { id: "opencloud-tripo-output", group: "opencloud", label: "Upload Tripo Output", endpoint: "/roblox/assets/models", desc: "Send latest Tripo model to Roblox Open Cloud", icon: Upload, output: "json", upload: "none", fields: [{ name: "modelUrl", label: "Tripo model URL", kind: "text", placeholder: "Leave blank to use latest output link" }, { name: "displayName", label: "Display name", kind: "text", def: "Tripo Generated Model" }, { name: "description", label: "Description", kind: "textarea", def: "Uploaded from Tripo output in Freed." }, { name: "dryRun", label: "Dry run", kind: "boolean", def: false }] },
  { id: "roblox-ugc-validator", group: "roblox", label: "Validate UGC", endpoint: "/roblox/avatar-validation/check", desc: "Roblox geometry rules", icon: ShieldCheck, output: "json", upload: "model", fields: [{ name: "assetType", label: "Asset type", kind: "select", def: "accessory", options: ["accessory", "body_part", "layered_clothing", "model"].map((value) => ({ label: value, value })) }, { name: "rulesJson", label: "Studio rules JSON", kind: "textarea" }] },
  { id: "roblox-upload-model", group: "roblox", label: "Upload Model", endpoint: "/roblox/assets/models", desc: "Roblox Open Cloud upload", icon: Upload, output: "json", upload: "model", fields: [{ name: "displayName", label: "Display name", kind: "text", def: "Bloxlab Website Model" }, { name: "description", label: "Description", kind: "textarea", def: "Uploaded from Bloxlab website." }, { name: "dryRun", label: "Dry run", kind: "boolean", def: false }] },
  { id: "roblox-operation", group: "opencloud", label: "Upload Status", endpoint: "/roblox/assets/operations", desc: "Poll Roblox operation", icon: BadgeCheck, output: "json", upload: "none", fields: [{ name: "operationId", label: "Operation ID", kind: "text" }] },
  { id: "roblox-open-cloud", group: "opencloud", label: "Open Cloud Status", endpoint: "/roblox/open-cloud/status", desc: "Configured Roblox keys", icon: ShieldCheck, output: "json", upload: "none", fields: [] },
  { id: "task-query", group: "common", label: "Task Query", endpoint: "/tripo/tasks", desc: "Poll an existing task id", icon: ClipboardList, output: "json", upload: "none", fields: [{ name: "task_id", label: "Task ID", kind: "text" }] },
  { id: "tripo-balance", group: "common", label: "Tripo Balance", endpoint: "/tripo/balance", desc: "Account balance", icon: ClipboardList, output: "json", upload: "none", fields: [] },
  { id: "tripo-usage", group: "common", label: "Tripo Usage", endpoint: "/tripo/account/usage", desc: "Account usage", icon: ClipboardList, output: "json", upload: "none", fields: [] },
];
const groupMeta: Record<Group, { label: string; icon: LucideIcon }> = { generate: { label: "Model", icon: Cuboid }, image: { label: "Image", icon: ImageIcon }, skybox: { label: "Skybox", icon: CloudSun }, models: { label: "Process", icon: FileBox }, mesh: { label: "Mesh", icon: Layers3 }, animation: { label: "Animate", icon: Play }, hymotion: { label: "HyMotion", icon: Activity }, opencloud: { label: "OpenCloud", icon: Upload }, roblox: { label: "Roblox", icon: ShieldCheck }, common: { label: "Task", icon: ClipboardList } };
const groups: Group[] = ["generate", "image", "skybox", "models", "mesh", "animation", "hymotion", "opencloud", "roblox", "common"];
const views = ["front", "left", "back", "right"] as const;
const modelExt = [".glb", ".gltf", ".fbx", ".obj", ".stl", ".3mf", ".usdz"];
const imageExt = [".png", ".jpg", ".jpeg", ".webp", ".gif"];
const fileExt = [...modelExt, ".rbxm", ".rbxmx", ".bvh", ".zip"];

function rootUrl() { return studioApiRoot(); }

function stored(key: string, fallback: string) { if (typeof window === "undefined") return fallback; return localStorage.getItem(key) || fallback; }
function defaults(op: Op) { const form: Form = {}; op.fields.forEach((field) => { form[field.name] = field.def !== undefined ? field.def : field.kind === "boolean" ? false : ""; }); return form; }
function lineList(value: Value) { return String(value || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean); }
function compact(input: Record<string, unknown>) { const out: Record<string, unknown> = {}; Object.entries(input).forEach(([key, value]) => { if (value === undefined || value === "") return; if (Array.isArray(value) && !value.length) return; out[key] = value; }); return out; }
function taskId(payload: any) { return String(payload?.task_id || payload?.data?.task_id || payload?.data?.id || payload?.output?.id || ""); }
function taskStatus(payload: any) { return String(payload?.data?.status || payload?.status || "unknown").toLowerCase(); }
function extOf(url: string) { const clean = url.split("?")[0].toLowerCase(); return [...fileExt, ...imageExt].find((ext) => clean.endsWith(ext)) || ""; }
function modelishKey(key: string) { return /(^|[_-])(model|mesh|gltf|glb|fbx|obj|stl|usdz|3mf)([_-]|$)|model_url|pbr_model|base_model/i.test(key); }
function imageishKey(key: string) { return /image|render|thumbnail|preview|screenshot|front|left|right|back/i.test(key); }
function linkKind(key: string, url: string): Link["kind"] { const clean = url.split("?")[0].toLowerCase(); if (imageExt.some((x) => clean.endsWith(x)) || imageishKey(key)) return "image"; if (modelExt.some((x) => clean.endsWith(x)) || modelishKey(key)) return "model"; return "file"; }
function canImportLink(link: Link) { const ext = extOf(link.url).toLowerCase(); if (ext) return ext === ".glb" || ext === ".gltf"; return link.kind === "model" && /gltf|glb|model|mesh|output/i.test(link.key); }
function labelUrl(key: string, url: string) { const ext = extOf(url).replace(".", "").toUpperCase(); if (["BVH", "RBXM", "RBXMX"].includes(ext) || /hymotion|animation/i.test(key)) return `${ext || "Animation"} Animation`; const kind = linkKind(key, url); if (kind === "model") return `${ext || "3D"} Model`; if (kind === "image") return `${ext || "Image"} Image`; return key.replace(/[_-]/g, " ") || "Output"; }
function linksFrom(payload: unknown): Link[] {
  const links: Link[] = [];
  const seen = new Set<string>();
  const seenObj = new Set<unknown>();
  const add = (key: string, url: string) => {
    if (!/^https?:\/\//i.test(url) || seen.has(url)) return;
    const ext = extOf(url);
    if (!ext && !/url|output|download|model|mesh|gltf|glb|image|render|animation|file/i.test(key)) return;
    seen.add(url);
    links.push({ label: labelUrl(key, url), url, key, kind: linkKind(key, url) });
  };
  const forceModelOutputs = (value: unknown) => {
    const root = value as any;
    const outputs = [root?.data?.output, root?.output, root?.tripo?.data?.output, root?.tripo?.output].filter(Boolean);
    for (const output of outputs) {
      for (const key of ["model_url", "pbr_model_url", "base_model_url", "raw_model_url", "glb_url", "gltf_url"]) {
        if (typeof output?.[key] === "string") add(key, output[key]);
      }
    }
  };
  const walk = (value: unknown, key = "output") => {
    if (!value || seenObj.has(value)) return;
    if (typeof value === "string") { add(key, value); return; }
    if (typeof value !== "object") return;
    seenObj.add(value);
    if (Array.isArray(value)) value.forEach((item) => walk(item, key));
    else Object.entries(value as Record<string, unknown>).forEach(([childKey, child]) => walk(child, childKey));
  };
  forceModelOutputs(payload);
  walk(payload);
  return links.sort((a, b) => {
    const rank = (link: Link) => canImportLink(link) ? 0 : link.kind === "model" ? 1 : link.kind === "file" ? 2 : 3;
    return rank(a) - rank(b);
  });
}
function storableModelLinks(links: Link[]) { return links.filter((link) => link.kind === "model" || /\.(glb|gltf|fbx|obj|stl|3mf|usdz)(\?|$)/i.test(link.url)); }
function filename(link: Link) { try { return new URL(link.url).pathname.split("/").pop() || `output${extOf(link.url) || ".bin"}`; } catch { return `output${extOf(link.url) || ".bin"}`; } }
async function gltfFilename(link: Link, blob: Blob) { let name = filename(link).replace(/[^\w .-]+/g, " ").trim() || "tripo-output"; let ext = extOf(link.url).toLowerCase(); if (ext !== ".glb" && ext !== ".gltf") { const type = blob.type.toLowerCase(); if (type.includes("gltf+json") || type.includes("json")) ext = ".gltf"; else { const head = new Uint8Array(await blob.slice(0, 4).arrayBuffer()); ext = head[0] === 0x67 && head[1] === 0x6c && head[2] === 0x54 && head[3] === 0x46 ? ".glb" : ".gltf"; } } if (!/\.(glb|gltf)$/i.test(name)) name = `${name.replace(/\.[^.]+$/, "") || "tripo-output"}${ext || ".glb"}`; return name; }
function boundsForImported(summary: ImportSummary) { const scene = useSceneStore.getState(); const geom = useGeometryStore.getState(); const min = new Vector3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY); const max = new Vector3(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY); const matrices = new Map<string, Matrix4>(); const matrixFor = (id: string): Matrix4 => { const cached = matrices.get(id); if (cached) return cached; const obj = scene.objects[id]; const local = new Matrix4(); if (obj) local.compose(new Vector3(obj.transform.position.x, obj.transform.position.y, obj.transform.position.z), new Quaternion().setFromEuler(new Euler(obj.transform.rotation.x, obj.transform.rotation.y, obj.transform.rotation.z)), new Vector3(obj.transform.scale.x, obj.transform.scale.y, obj.transform.scale.z)); const world = obj?.parentId && scene.objects[obj.parentId] ? matrixFor(obj.parentId).clone().multiply(local) : local; matrices.set(id, world); return world; }; let any = false; for (const oid of summary.createdObjectIds) { const obj = scene.objects[oid]; if (!obj?.meshId) continue; const mesh = geom.meshes.get(obj.meshId); if (!mesh) continue; const mat = matrixFor(oid); for (const vertex of mesh.vertices) { const point = new Vector3(vertex.position.x, vertex.position.y, vertex.position.z).applyMatrix4(mat); min.min(point); max.max(point); any = true; } } if (!any) return null; const center = min.clone().add(max).multiplyScalar(0.5); const sizeVec = max.clone().sub(min); return { center: [center.x, center.y, center.z] as [number, number, number], size: Math.max(sizeVec.x, sizeVec.y, sizeVec.z, 0.5) }; }
function revealImported(summary: ImportSummary) { useSceneStore.getState().selectObject(summary.rootGroupId); const selection = useSelectionStore.getState(); if (selection.selection.viewMode === "object") selection.selectObjects([summary.rootGroupId], false); const bounds = boundsForImported(summary); if (bounds) useViewportStore.getState().focusOnObject(bounds.center, bounds.size); }
function skyboxPrompt(basePrompt: string, face: SkyboxFaceName) {
  return [
    basePrompt,
    `Roblox-style seamless cube-map skybox ${skyboxFaceLabel[face]} face.`,
    "Square 1:1 environment texture, 90 degree field of view, continuous horizon, soft lighting, no UI, no text, no character, no foreground object.",
    "Make this face align naturally with the other cube faces.",
  ].join(" ");
}
function firstImageLink(payload: unknown) {
  return linksFrom(payload).find((link) => link.kind === "image" || imageExt.some((ext) => link.url.split("?")[0].toLowerCase().endsWith(ext)));
}

function compactStringify(value: unknown, max = 900) {
  try {
    const text = typeof value === "string" ? value : JSON.stringify(value);
    return text.length > max ? `${text.slice(0, max)}...` : text;
  } catch {
    return String(value).slice(0, max);
  }
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 || unit === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`;
}

function payloadMessage(payload: any, fallback = "Unknown API error") {
  return String(
    payload?.error?.message ||
    payload?.message ||
    payload?.data?.error_msg ||
    payload?.data?.error_message ||
    payload?.data?.message ||
    payload?.tripo?.message ||
    payload?.tripo?.data?.error_msg ||
    payload?.raw ||
    fallback
  );
}

function detailedMessage(title: string, payload: unknown) {
  const payloadAny = payload as any;
  const status = taskStatus(payloadAny);
  const task = taskId(payloadAny);
  const base = payloadMessage(payloadAny, title);
  const details = compactStringify(payloadAny?.error?.details || payloadAny?.details || payloadAny?.data || payloadAny, 700);
  const meta = [task ? `task ${task}` : "", status && status !== "unknown" ? `status ${status}` : ""].filter(Boolean).join(", ");
  return `${title}${meta ? ` (${meta})` : ""}: ${base}${details && details !== base ? ` | ${details}` : ""}`;
}

export default function TripoPanel() {
  const [apiRoot, setApiRoot] = useState(rootUrl);
  const [clientKey, setClientKey] = useState(() => stored("freed.api.clientKey", "local-dev-key"));
  const [adminKey, setAdminKey] = useState(() => stored("freed.api.adminKey", "local-admin-key"));
  const [group, setGroup] = useState<Group>("generate");
  const [opId, setOpId] = useState("text-to-model");
  const op = useMemo(() => ops.find((item) => item.id === opId) || ops[0], [opId]);
  const [form, setForm] = useState<Form>(() => defaults(ops.find((item) => item.id === "text-to-model") || ops[0]));
  const [upload, setUpload] = useState<File | null>(null);
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState("");
  const [viewUrls, setViewUrls] = useState<Record<string, string>>({ front: "", left: "", back: "", right: "" });
  const [viewFiles, setViewFiles] = useState<Record<string, File | null>>({ front: null, left: null, back: null, right: null });
  const [skyboxUploads, setSkyboxUploads] = useState<Partial<Record<SkyboxFaceName, SkyboxUpload>>>({});
  const [busy, setBusy] = useState(false);
  const [autoImport, setAutoImport] = useState(true);
  const [progress, setProgress] = useState({ label: "Ready", value: 0 });
  const [error, setError] = useState("");
  const [history, setHistory] = useState<History[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [raw, setRaw] = useState<unknown>(null);
  const [report, setReport] = useState<RobloxReport | null>(null);
  const addGeneratedModels = useGeneratedModelsStore((state) => state.addAssets);
  const activeOps = ops.filter((item) => item.group === group);
  const fields = op.fields.filter((field) => !field.show || field.show(form));
  const OpIcon = op.icon;
  const uploadMeta = upload ? `${upload.type || "File"} - ${formatBytes(upload.size)}` : "";
  const skyboxUploadCount = skyboxFaces.filter((face) => Boolean(skyboxUploads[face])).length;
  const uploadedSkyboxFaces = useMemo<SkyboxFaces | null>(() => {
    if (skyboxFaces.some((face) => !skyboxUploads[face]?.url)) return null;
    return skyboxFaces.reduce((acc, face) => {
      acc[face] = skyboxUploads[face]!.url;
      return acc;
    }, {} as SkyboxFaces);
  }, [skyboxUploads]);

  useEffect(() => {
    if (op.upload !== "image" || !upload || !upload.type.startsWith("image/")) {
      setUploadPreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(upload);
    setUploadPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [op.upload, upload]);

  useEffect(() => {
    if (op.group !== "skybox") return;
    if (!uploadedSkyboxFaces) {
      if (skyboxUploadCount > 0) {
        useViewportStore.getState().clearSkybox();
        setRaw(null);
        setProgress({ label: `Waiting for skybox faces ${skyboxUploadCount}/6`, value: Math.round((skyboxUploadCount / 6) * 90) });
      }
      return;
    }
    useViewportStore.getState().setSkyboxFaces(uploadedSkyboxFaces);
    setLinks([]);
    setRaw({ status: "local", skybox_faces: uploadedSkyboxFaces });
    setProgress({ label: "Skybox in viewport", value: 100 });
    setError("");
  }, [op.group, skyboxUploadCount, uploadedSkyboxFaces]);

  function switchOp(next: Op) { setGroup(next.group); setOpId(next.id); setForm(defaults(next)); setUpload(null); setReport(null); setError(""); setProgress({ label: "Ready", value: 0 }); }
  function setSkyboxFaceFile(face: SkyboxFaceName, file: File | null) {
    const previousUrl = skyboxUploads[face]?.url;
    if (previousUrl) URL.revokeObjectURL(previousUrl);
    if (!file) {
      setSkyboxUploads((current) => {
        const next = { ...current };
        delete next[face];
        return next;
      });
      return;
    }
    const url = URL.createObjectURL(file);
    setSkyboxUploads((current) => ({ ...current, [face]: { file, url } }));
  }
  function clearUploadedSkybox() {
    Object.values(skyboxUploads).forEach((entry) => {
      if (entry?.url) URL.revokeObjectURL(entry.url);
    });
    setSkyboxUploads({});
    useViewportStore.getState().clearSkybox();
    setLinks([]);
    setRaw(null);
    setError("");
    setProgress({ label: "Ready", value: 0 });
  }
  function setField(name: string, value: Value) { setForm((current) => ({ ...current, [name]: value })); }
  function makeHeaders(json = true, admin = true) { const h = new Headers(); h.set("x-api-key", clientKey.trim()); if (adminKey.trim() && admin) h.set("x-admin-key", adminKey.trim()); if (json) h.set("content-type", "application/json"); return h; }
  async function read(response: Response) {
    const text = await response.text();
    let payload: any = {};
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      payload = { raw: text };
    }
    if (!response.ok || payload.ok === false) {
      throw new Error(detailedMessage(`HTTP ${response.status} ${response.statusText || "API error"}`, payload));
    }
    return payload;
  }
  async function api(path: string, init: RequestInit = {}, admin = true) { const h = makeHeaders(!(init.body instanceof FormData), admin); new Headers(init.headers).forEach((v, k) => h.set(k, v)); return read(await fetch(`${apiRoot}${path}`, { ...init, headers: h })); }
  async function uploadTripo(file: File) { setProgress({ label: "Uploading file", value: 10 }); const data = new FormData(); data.append("file", file, file.name); const payload = await api("/tripo/upload", { method: "POST", body: data }, false); const token = payload?.image_token || payload?.file_token || payload?.data?.image_token || payload?.data?.file_token; if (!token) throw new Error("Upload did not return file token."); return String(token); }
  async function buildPayload() { const payload: Record<string, unknown> = {}; fields.forEach((field) => { if (["inputs_text", "part_names_text", "animations_text"].includes(field.name)) return; const value = form[field.name]; if (field.kind === "number") { if (value !== "" && value !== undefined) payload[field.name] = Number(value); return; } if (field.kind === "boolean") { payload[field.name] = Boolean(value); return; } if (value !== "" && value !== undefined) payload[field.name] = value; }); if (form.inputs_text) payload.inputs = lineList(form.inputs_text); if (form.part_names_text) payload.part_names = lineList(form.part_names_text); if (form.animation_mode === "multiple") { payload.animations = lineList(form.animations_text); delete payload.animation; } if (op.upload === "multiview") { const inputs: Record<string, string> = {}; for (const key of views) { if (viewFiles[key]) inputs[key] = await uploadTripo(viewFiles[key] as File); else if (viewUrls[key].trim()) inputs[key] = viewUrls[key].trim(); } if (Object.keys(inputs).length) payload.inputs = inputs; } else if (upload && op.upload && op.upload !== "none") { const token = await uploadTripo(upload); if (op.id === "image-to-model") { delete payload.input; payload.image_token = token; } else payload.input = token; } return compact(payload); }
  async function poll(id: string) { const done = ["success", "succeeded", "complete", "completed"]; const failed = ["failed", "cancelled", "canceled", "banned", "expired"]; for (let i = 0; i < 180; i++) { const payload = await api(`/tripo/tasks/${encodeURIComponent(id)}`, { method: "GET" }, false); const nextLinks = linksFrom(payload); setRaw(payload); setLinks(nextLinks); const status = taskStatus(payload); const value = done.includes(status) ? 96 : Math.min(95, 12 + Math.floor(i * 0.7)); setProgress({ label: `Tripo ${status}${nextLinks.length && !done.includes(status) ? " - waiting final output" : ""}`, value }); if (failed.includes(status)) throw new Error(JSON.stringify(payload?.data || payload).slice(0, 500)); if (done.includes(status)) return payload; await new Promise((resolve) => setTimeout(resolve, 2000)); } throw new Error("Task polling timed out."); }
  function downloadUrl(link: Link) { if (link.url.includes("/hymotion/animations/") || link.url.startsWith(apiRoot)) return link.url; return `${apiRoot}/tripo/download?url=${encodeURIComponent(link.url)}`; }
  async function saveLink(link: Link) { setProgress({ label: "Downloading output", value: 98 }); const response = await fetch(downloadUrl(link), { headers: { "x-api-key": clientKey.trim() } }); if (!response.ok) throw new Error(`Download failed HTTP ${response.status}`); const blob = await response.blob(); const objectUrl = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = objectUrl; anchor.download = filename(link); document.body.appendChild(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30000); setProgress({ label: "Downloaded", value: 100 }); }
  async function uploadGeneratedToRoblox(modelUrl?: string) { const outputUrl = String(modelUrl || form.modelUrl || links.find((link) => link.kind === "model" || /\.(glb|gltf|fbx|rbxm|rbxmx)(\?|$)/i.test(link.url))?.url || "").trim(); if (!outputUrl) throw new Error("No Tripo model URL. Generate a model first or paste a model URL."); setProgress({ label: "Downloading Tripo output", value: 25 }); const virtualLink: Link = { label: "Tripo Output", url: outputUrl, kind: "model", key: "opencloud" }; const response = await fetch(downloadUrl(virtualLink), { headers: { "x-api-key": clientKey.trim() } }); if (!response.ok) throw new Error(`Download failed HTTP ${response.status}`); const blob = await response.blob(); let fileName = filename(virtualLink).replace(/[^\w .-]+/g, " ").trim() || "tripo-output.glb"; if (!/\.(glb|gltf|fbx|rbxm|rbxmx)$/i.test(fileName)) fileName += ".glb"; const data = new FormData(); data.append("displayName", String(form.displayName || fileName.replace(/\.[^.]+$/, "") || "Tripo Generated Model")); data.append("description", String(form.description || "Uploaded from Tripo output in Freed.")); data.append("dryRun", String(Boolean(form.dryRun))); data.append("file", new File([blob], fileName, { type: blob.type || "model/gltf-binary" })); setProgress({ label: "Uploading to Roblox Open Cloud", value: 65 }); return api("/roblox/assets/models", { method: "POST", body: data }, true); }
  async function importLink(link: Link) { if (!canImportLink(link)) throw new Error("Freed view supports GLB/GLTF only. Convert to GLTF first."); setProgress({ label: "Loading model into view", value: 98 }); const response = await fetch(downloadUrl(link), { headers: { "x-api-key": clientKey.trim() } }); if (!response.ok) throw new Error(`Download failed HTTP ${response.status}`); const blob = await response.blob(); const summary = await importGLTFFile(new File([blob], await gltfFilename(link, blob), { type: blob.type || "model/gltf-binary" })); revealImported(summary); setProgress({ label: `Model in view (${summary.createdMeshIds.length} meshes)`, value: 100 }); return summary; }
  async function pollSkyboxFace(taskIdValue: string, face: SkyboxFaceName, doneCountRef: { current: number }) {
    const done = ["success", "succeeded", "complete", "completed"];
    const failed = ["failed", "cancelled", "canceled", "banned", "expired"];
    for (let i = 0; i < 180; i++) {
      const payload = await api(`/tripo/tasks/${encodeURIComponent(taskIdValue)}`, { method: "GET" }, false);
      setRaw(payload);
      const status = taskStatus(payload);
      const value = Math.min(94, Math.round(10 + doneCountRef.current * 14 + Math.min(13, i * 0.18)));
      setProgress({ label: `Skybox ${skyboxFaceLabel[face]} ${status}`, value });
      if (failed.includes(status)) {
        throw new Error(detailedMessage(`Skybox ${skyboxFaceLabel[face]} failed`, payload));
      }
      if (done.includes(status)) return payload;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    throw new Error(`Skybox ${skyboxFaceLabel[face]} timed out after 6 minutes (task ${taskIdValue}).`);
  }
  async function createSkybox() {
    const basePrompt = String(form.prompt || "").trim();
    if (!basePrompt) throw new Error("Skybox prompt is required.");
    useViewportStore.getState().clearSkybox();
    setLinks([]);
    setRaw(null);
    setProgress({ label: "Submitting 6 skybox faces", value: 5 });
    const imageModel = String(form.model || "seedream_v5");
    const template = String(form.template || "");
    const submissions: Array<{ face: SkyboxFaceName; id: string; payload: unknown }> = [];

    for (const [index, face] of skyboxFaces.entries()) {
      setProgress({ label: `Submitting skybox ${skyboxFaceLabel[face]} ${index + 1}/6`, value: 5 + index * 2 });
      try {
        const payload = await api("/tripo/generation/text-to-image", {
          method: "POST",
          body: JSON.stringify(compact({
            prompt: skyboxPrompt(basePrompt, face),
            model: imageModel,
            template,
          })),
        }, false);
        setRaw(payload);
        const id = taskId(payload);
        if (!id && !firstImageLink(payload)) {
          throw new Error(detailedMessage(`Skybox ${skyboxFaceLabel[face]} submit did not return a task id or image`, payload));
        }
        submissions.push({ face, id, payload });
        if (id) {
          setHistory((items) => [{ id, label: `Skybox ${skyboxFaceLabel[face]}`, status: "submitted" }, ...items].slice(0, 8));
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(`Skybox submit failed on ${skyboxFaceLabel[face]} face: ${message}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 450));
    }

    const doneCountRef = { current: 0 };
    const settled = await Promise.allSettled(submissions.map(async ({ face, id, payload }) => {
      const finalPayload = id ? await pollSkyboxFace(id, face, doneCountRef) : payload;
      const image = firstImageLink(finalPayload);
      if (!image) {
        throw new Error(detailedMessage(`Skybox ${skyboxFaceLabel[face]} finished but did not return an image URL`, finalPayload));
      }
      doneCountRef.current += 1;
      setProgress({ label: `Skybox face ready ${doneCountRef.current}/6`, value: Math.min(96, 10 + doneCountRef.current * 14) });
      return { ...image, label: `Skybox ${skyboxFaceLabel[face]}`, key: `skybox_${face}`, face };
    }));
    const failures = settled.flatMap((result, index) => {
      if (result.status === "fulfilled") return [];
      const face = submissions[index]?.face;
      const id = submissions[index]?.id;
      return [`${face ? skyboxFaceLabel[face] : `face ${index + 1}`}${id ? ` (${id})` : ""}: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`];
    });
    const faceLinks = settled.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);

    if (failures.length) {
      setRaw({ status: "failed", completed_faces: faceLinks.length, failed_faces: failures, submissions });
      throw new Error(`Skybox failed on ${failures.length}/6 face(s). ${failures.join(" | ")}`);
    }

    const faces = faceLinks.reduce((acc, link) => {
      acc[link.face] = link.url;
      return acc;
    }, {} as Partial<SkyboxFaces>) as SkyboxFaces;
    const outputLinks = faceLinks.map(({ face: _face, ...link }) => link);
    useViewportStore.getState().setSkyboxFaces(faces);
    setLinks(outputLinks);
    const payload = { status: "success", skybox_faces: faces };
    setRaw(payload);
    setProgress({ label: "Skybox in viewport", value: 100 });
    return payload;
  }
  async function run() { setBusy(true); setError(""); setReport(null); setLinks([]); try { localStorage.setItem("freed.api.clientKey", clientKey.trim()); localStorage.setItem("freed.api.adminKey", adminKey.trim()); setProgress({ label: `Submitting ${op.label}`, value: 3 }); let payload: any; if (op.group === "opencloud") { if (op.id === "opencloud-tripo-output") payload = await uploadGeneratedToRoblox(); else if (op.id === "roblox-open-cloud") payload = await api(op.endpoint, { method: "GET" }, true); else if (op.id === "roblox-operation") { const id = String(form.operationId || "").trim(); if (!id) throw new Error("Operation ID is required."); payload = await api(`/roblox/assets/operations/${encodeURIComponent(id)}`, { method: "GET" }, true); } } else if (op.group === "roblox") { if (!upload) throw new Error("Choose a model file first."); const data = new FormData(); data.append("file", upload, upload.name); Object.entries(form).forEach(([k, v]) => data.append(k, String(v ?? ""))); payload = await api(op.endpoint, { method: "POST", body: data }, op.id !== "roblox-ugc-validator"); if (op.id === "roblox-ugc-validator") setReport(payload.roblox || null); } else if (op.id === "task-query") { const id = String(form.task_id || "").trim(); if (!id) throw new Error("Task ID is required."); payload = await api(`/tripo/tasks/${encodeURIComponent(id)}`, { method: "GET" }, false); } else if (op.id === "tripo-balance" || op.id === "tripo-usage") payload = await api(op.endpoint, { method: "GET" }, true); else if (op.id === "skybox-upload") { if (!uploadedSkyboxFaces) throw new Error("Upload all 6 skybox faces first."); useViewportStore.getState().setSkyboxFaces(uploadedSkyboxFaces); payload = { status: "local", skybox_faces: uploadedSkyboxFaces }; setProgress({ label: "Skybox in viewport", value: 100 }); } else if (op.group === "skybox") payload = await createSkybox(); else if (op.group === "hymotion") payload = await api(op.endpoint, { method: "POST", body: JSON.stringify(compact({ ...form })) }, false); else { payload = await api(op.endpoint, { method: "POST", body: JSON.stringify(await buildPayload()) }, false); const id = taskId(payload); if (id) { setHistory((items) => [{ id, label: op.label, status: "submitted" }, ...items].slice(0, 8)); payload = await poll(id); } } const nextLinks = linksFrom(payload); setRaw(payload); setLinks(nextLinks); const id = taskId(payload); if (id) setHistory((items) => [{ id, label: op.label, status: taskStatus(payload) }, ...items.filter((item) => item.id !== id)].slice(0, 8)); const generatedModels = storableModelLinks(nextLinks); if (generatedModels.length) addGeneratedModels(generatedModels.map((link) => ({ label: link.label, url: link.url, key: link.key, kind: link.kind === "file" ? "file" : "model", source: op.label, taskId: id || undefined, status: taskStatus(payload) }))); const importable = nextLinks.find(canImportLink); if (autoImport && importable) await importLink(importable); else if (op.output === "model" && taskStatus(payload) === "success" && !importable) { setError("Tripo finished but this response has no GLB/GLTF model URL. It only has preview/image output."); setProgress({ label: "No model output", value: 96 }); } else if (op.group !== "skybox") setProgress({ label: nextLinks.length ? "Output ready" : "API response ready", value: 100 }); } catch (err) { setError(err instanceof Error ? err.message : String(err)); setProgress({ label: "Failed", value: 0 }); } finally { setBusy(false); } }
  function render(field: Field) {
    const value = form[field.name];
    const wide = field.kind === "boolean" || field.kind === "textarea" || field.kind === "multiline" || ["prompt", "negative_prompt", "description", "rulesJson"].includes(field.name);

    if (field.kind === "boolean") {
      return (
        <div key={field.name} className={`${styles.toggleRow} ${wide ? styles.fieldWide : ""}`}>
          <span>{field.label}</span>
          <button
            type="button"
            className={`${styles.switch} ${value ? styles.switchOn : ""}`}
            onClick={() => setField(field.name, !value)}
            disabled={busy}
            aria-pressed={Boolean(value)}
          >
            <span />
            <b>{value ? "On" : "Off"}</b>
          </button>
        </div>
      );
    }

    if (field.kind === "textarea" || field.kind === "multiline") {
      return (
        <label key={field.name} className={`${styles.field} ${wide ? styles.fieldWide : ""}`}>
          <span>{field.label}</span>
          <textarea
            className={styles.textarea}
            value={String(value ?? "")}
            placeholder={field.placeholder}
            onChange={(e) => setField(field.name, e.target.value)}
            disabled={busy}
          />
        </label>
      );
    }

    if (field.kind === "select") {
      return (
        <label key={field.name} className={`${styles.field} ${wide ? styles.fieldWide : ""}`}>
          <span>{field.label}</span>
          <select
            className={styles.control}
            value={String(value ?? "")}
            onChange={(e) => setField(field.name, e.target.value)}
            disabled={busy}
          >
            {(field.options || []).map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
      );
    }

    return (
      <label key={field.name} className={`${styles.field} ${wide ? styles.fieldWide : ""}`}>
        <span>{field.label}</span>
        <input
          className={styles.control}
          type={field.kind === "number" ? "number" : "text"}
          min={field.min}
          max={field.max}
          step={field.step}
          value={String(value ?? "")}
          placeholder={field.placeholder}
          onChange={(e) => setField(field.name, e.target.value)}
          disabled={busy}
        />
      </label>
    );
  }

  const progressValue = Math.max(0, Math.min(100, progress.value));
  const importableLinks = links.filter(canImportLink);
  const runDisabled = busy || (op.id === "skybox-upload" && !uploadedSkyboxFaces);
  const runLabel = op.id === "skybox-upload" ? (uploadedSkyboxFaces ? "Apply Skybox" : "Upload 6 Faces") : op.group === "skybox" ? "Create Skybox" : "Run AI";

  return (
    <aside className={styles.shell}>
      <nav className={styles.rail} aria-label="API workspace sections">
        <div className={styles.logoMark}>
          <Box size={18} />
        </div>
        <div className={styles.railItems}>
          {groups.map((g) => {
            const meta = groupMeta[g];
            const Icon = meta.icon;
            const active = group === g;
            return (
              <button
                key={g}
                type="button"
                className={`${styles.railButton} ${active ? styles.railButtonActive : ""}`}
                onClick={() => switchOp(ops.find((item) => item.group === g) || op)}
                disabled={busy}
                title={meta.label}
              >
                <Icon size={18} />
                <span>{meta.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <div className={styles.panel}>
        <header className={styles.header}>
          <div className={styles.headerIcon}>
            <OpIcon size={18} />
          </div>
          <div className={styles.headerCopy}>
            <strong>UGC AI Studio</strong>
            <span>{op.label} to live 3D viewport</span>
          </div>
          <button
            type="button"
            className={`${styles.autoButton} ${autoImport ? styles.autoButtonOn : ""}`}
            onClick={() => setAutoImport((value) => !value)}
          >
            {autoImport ? "Auto" : "Manual"}
          </button>
        </header>

        <div className={styles.scrollArea}>
          <section className={styles.block}>
            <div className={styles.blockTitle}>Operation</div>
            <label className={styles.selectWrap}>
              <select
                className={styles.operationSelect}
                value={opId}
                onChange={(e) => switchOp(ops.find((item) => item.id === e.target.value) || op)}
                disabled={busy}
              >
                {activeOps.map((item) => (
                  <option key={item.id} value={item.id}>{item.label} - {item.desc}</option>
                ))}
              </select>
              <ChevronDown size={16} />
            </label>
          </section>

          {op.upload && !["none", "multiview"].includes(op.upload) ? (
            <section className={styles.block}>
              <div className={styles.blockTitle}>Input file</div>
              <label className={styles.uploadBox}>
                <span><Upload size={14} /> Upload {op.upload}</span>
                <input
                  className={styles.fileInput}
                  type="file"
                  accept={op.upload === "image" ? "image/png,image/jpeg,image/webp" : ".glb,.gltf,.fbx,.obj,.stl,.rbxm,.rbxmx"}
                  onChange={(e) => setUpload(e.target.files?.[0] || null)}
                  disabled={busy}
                />
              </label>
              {op.upload === "image" && uploadPreviewUrl && upload ? (
                <div className={styles.uploadPreview}>
                  <img src={uploadPreviewUrl} alt={`Preview of ${upload.name}`} />
                  <div className={styles.uploadPreviewMeta}>
                    <strong title={upload.name}>{upload.name}</strong>
                    <span>{uploadMeta}</span>
                  </div>
                </div>
              ) : upload ? (
                <div className={styles.uploadFileMeta}>
                  <strong title={upload.name}>{upload.name}</strong>
                  <span>{uploadMeta}</span>
                </div>
              ) : null}
            </section>
          ) : null}

          {op.upload === "multiview" ? (
            <section className={styles.block}>
              <div className={styles.blockTitle}>Multi view input</div>
              <div className={styles.viewGrid}>
                {views.map((key) => (
                  <div key={key} className={styles.viewCell}>
                    <label className={styles.field}>
                      <span>{key} URL</span>
                      <input
                        className={styles.control}
                        value={viewUrls[key]}
                        onChange={(e) => setViewUrls((current) => ({ ...current, [key]: e.target.value }))}
                      />
                    </label>
                    <input
                      className={styles.fileInputMini}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => setViewFiles((current) => ({ ...current, [key]: e.target.files?.[0] || null }))}
                    />
                  </div>
                ))}
              </div>
            </section>
          ) : null}


          {op.group === "skybox" ? (
            <section className={styles.block}>
              <div className={styles.skyboxUploadHeader}>
                <div className={styles.blockTitle}>Upload skybox faces</div>
                <span className={styles.skyboxCounter}>{skyboxUploadCount}/6</span>
              </div>
              <div className={styles.skyboxFaceGrid}>
                {skyboxFaces.map((face) => {
                  const entry = skyboxUploads[face];
                  return (
                    <div key={face} className={styles.skyboxFaceCell}>
                      <div className={styles.skyboxFaceHeader}>
                        <span>{skyboxFaceLabel[face]}</span>
                        {entry ? (
                          <button type="button" onClick={() => setSkyboxFaceFile(face, null)} disabled={busy}>
                            Clear
                          </button>
                        ) : null}
                      </div>
                      <label className={styles.skyboxDrop}>
                        {entry ? (
                          <img src={entry.url} alt={`${skyboxFaceLabel[face]} skybox face`} />
                        ) : (
                          <span><Upload size={14} /> Upload</span>
                        )}
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={(e) => setSkyboxFaceFile(face, e.target.files?.[0] || null)}
                          disabled={busy}
                        />
                      </label>
                      {entry ? (
                        <div className={styles.skyboxFaceMeta}>
                          <strong title={entry.file.name}>{entry.file.name}</strong>
                          <span>{formatBytes(entry.file.size)}</span>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              <div className={styles.skyboxActions}>
                <span>{uploadedSkyboxFaces ? "Live in viewport" : "Waiting for all faces"}</span>
                <button type="button" onClick={clearUploadedSkybox} disabled={!skyboxUploadCount || busy}>Clear skybox</button>
              </div>
            </section>
          ) : null}
          <section className={styles.block}>
            <div className={styles.formGrid}>{fields.map(render)}</div>
          </section>

          <details className={styles.details}>
            <summary><KeyRound size={14} /> API settings</summary>
            <div className={styles.detailsBody}>
              <label className={`${styles.field} ${styles.fieldWide}`}>
                <span>Backend API root</span>
                <input className={styles.control} value={apiRoot} onChange={(e) => setApiRoot(e.target.value.replace(/\/$/, ""))} />
              </label>
              <label className={`${styles.field} ${styles.fieldWide}`}>
                <span>Client API key</span>
                <input className={styles.control} value={clientKey} onChange={(e) => setClientKey(e.target.value)} />
              </label>
              <label className={`${styles.field} ${styles.fieldWide}`}>
                <span>Admin API key</span>
                <input className={styles.control} value={adminKey} onChange={(e) => setAdminKey(e.target.value)} />
              </label>
            </div>
          </details>

          {error ? <div className={styles.errorBox}>{error}</div> : null}

          <section className={styles.statusBlock}>
            <div className={styles.progressHeader}>
              <span>{progress.label}</span>
              <strong>{progressValue}%</strong>
            </div>
            <div className={styles.progressTrack}>
              <div style={{ width: `${progressValue}%` }} />
            </div>
          </section>


          {report ? (
            <section className={styles.outputBlock}>
              <div className={styles.outputHeader}>
                <strong>Roblox validation</strong>
                <span>{report.status}</span>
              </div>
              {report.issues?.slice(0, 8).map((issue) => (
                <div key={issue.code} className={styles.issueRow}>{issue.label}: {issue.message}</div>
              ))}
            </section>
          ) : null}

          {history.length ? (
            <section className={styles.outputBlock}>
              <div className={styles.blockTitle}>Task history</div>
              <div className={styles.historyList}>
                {history.map((item) => (
                  <button
                    key={`${item.id}-${item.label}`}
                    type="button"
                    className={styles.historyItem}
                    onClick={() => {
                      const q = ops.find((x) => x.id === "task-query") || op;
                      switchOp(q);
                      setForm({ task_id: item.id });
                    }}
                  >
                    <span>{item.label}</span>
                    <b>{item.id}</b>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {links.length ? (
            <section className={styles.outputBlock}>
              <div className={styles.outputHeader}>
                <strong>Output links</strong>
                <span>{importableLinks.length ? `${importableLinks.length} importable` : `${links.length} files`}</span>
              </div>
              <div className={styles.linkList}>
                {links.map((link) => (
                  <div key={`${link.key}-${link.url}`} className={styles.linkCard}>
                    <div className={styles.linkTop}>
                      <strong>{link.label}</strong>
                      <span>{link.kind}</span>
                    </div>
                    <p>{link.url}</p>
                    <div className={styles.linkActions}>
                      <button type="button" onClick={() => saveLink(link).catch((err) => setError(err instanceof Error ? err.message : String(err)))} disabled={busy}>
                        <Download size={14} /> Download
                      </button>
                      {canImportLink(link) ? (
                        <button type="button" className={styles.primarySmall} onClick={() => importLink(link).catch((err) => setError(err instanceof Error ? err.message : String(err)))} disabled={busy}>
                          <Box size={14} /> View 3D
                        </button>
                      ) : null}
                      {link.kind === "model" ? (
                        <button type="button" onClick={() => uploadGeneratedToRoblox(link.url).then((payload) => { setRaw(payload); setProgress({ label: "Roblox upload submitted", value: 100 }); }).catch((err) => setError(err instanceof Error ? err.message : String(err)))} disabled={busy}>
                          <Upload size={14} /> OpenCloud
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {raw ? (
            <details className={styles.details}>
              <summary>Raw response</summary>
              <pre className={styles.rawBox}>{JSON.stringify(raw, null, 2)}</pre>
            </details>
          ) : null}
        </div>

        <footer className={styles.footer}>
          <button type="button" className={styles.runButton} onClick={run} disabled={runDisabled}>
            {busy ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
            {runLabel}
          </button>
        </footer>
      </div>
    </aside>
  );
}









