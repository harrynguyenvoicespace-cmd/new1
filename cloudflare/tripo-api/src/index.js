const DEFAULT_TRIPO_API_BASE_URL = "https://api.tripo3d.ai/v2/openapi";
const DEFAULT_PUBLIC_ROOT = "https://tripo-cloudflare-api.harrynguyenvoicespace.workers.dev/v1";

const modelTaskRoutes = new Map([
  ["/tripo/generation/text-to-model", "text_to_model"],
  ["/tripo/generation/image-to-model", "image_to_model"],
  ["/tripo/generation/multiview-to-model", "multiview_to_model"],
  ["/tripo/generation/image-to-splat", "image_to_3dgs"],
  ["/tripo/models/texture", "texture_model"],
  ["/tripo/models/import", "import_model"],
  ["/tripo/models/convert", "convert_model"],
  ["/tripo/mesh/segment", "mesh_segmentation"],
  ["/tripo/mesh/complete", "mesh_completion"],
  ["/tripo/mesh/decimate", "highpoly_to_lowpoly"],
  ["/tripo/animations/rig-check", "animate_prerigcheck"],
  ["/tripo/animations/rig", "animate_rig"],
  ["/tripo/animations/retarget", "animate_retarget"],
]);

const imageTaskRoutes = new Map([
  ["/tripo/generation/text-to-image", "generate_image"],
  ["/tripo/generation/image-to-image", "generate_image"],
  ["/tripo/generation/image-to-multiview", "generate_multiview_image"],
  ["/tripo/generation/edit-multiview", "edit_multiview_image"],
]);


export class RateLimitBucket {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch() {
    return new Response(JSON.stringify({ ok: true, service: "RateLimitBucket", preserved: true }), {
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
}
export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }

    try {
      return await handleRequest(request, env, ctx);
    } catch (error) {
      console.error(JSON.stringify({ level: "error", message: error?.message || String(error) }));
      return json(request, env, { error: { message: "Tripo proxy failed", details: error?.message || String(error) } }, 500);
    }
  },
};

async function handleRequest(request, env) {
  const url = new URL(request.url);
  const path = stripVersionPrefix(url.pathname);

  if (request.method === "GET" && (path === "/" || path === "/health")) {
    return json(request, env, {
      ok: true,
      service: "tripo-cloudflare-api",
      version: "v1",
      upstream: upstreamBase(env),
      publicRoot: env.PUBLIC_API_ROOT_URL || DEFAULT_PUBLIC_ROOT,
    });
  }

  if (path === "/tripo/download" && request.method === "GET") {
    return downloadFile(request, env, url.searchParams.get("url"));
  }

  if (path === "/tripo/upload" && request.method === "POST") {
    return forwardToTripo(request, env, "/upload/sts");
  }

  if (path.startsWith("/tripo/tasks/") && request.method === "GET") {
    const id = decodeURIComponent(path.slice("/tripo/tasks/".length));
    return forwardToTripo(request, env, `/task/${encodeURIComponent(id)}`);
  }

  if (path === "/tripo/tasks" && request.method === "GET") {
    const taskId = url.searchParams.get("task_id") || url.searchParams.get("id");
    if (!taskId) return json(request, env, { error: { message: "task_id is required" } }, 400);
    return forwardToTripo(request, env, `/task/${encodeURIComponent(taskId)}`);
  }

  if (path === "/tripo/balance" && request.method === "GET") {
    return forwardToTripo(request, env, "/user/balance");
  }

  if (path === "/tripo/account/usage" && request.method === "GET") {
    return forwardToTripo(request, env, "/user/usage");
  }

  if (request.method === "POST" && modelTaskRoutes.has(path)) {
    const body = await readJson(request);
    const payload = buildModelTaskPayload(path, body, modelTaskRoutes.get(path));
    return postTask(request, env, payload);
  }

  if (request.method === "POST" && imageTaskRoutes.has(path)) {
    const body = await readJson(request);
    const payload = buildImageTaskPayload(path, body, imageTaskRoutes.get(path));
    return postTask(request, env, payload);
  }

  return json(request, env, {
    error: {
      message: "Unsupported proxy route",
      route: path,
      hint: "Use /v1/tripo/upload, /v1/tripo/generation/*, /v1/tripo/tasks/:id, /v1/tripo/download, or /v1/tripo/balance.",
    },
  }, 404);
}

function buildModelTaskPayload(path, body, type) {
  const payload = normalizeEmpty({ ...body, type });

  if (path.includes("generation/text-to-model")) {
    return normalizeModelVersion(payload);
  }

  if (path.includes("generation/image-to-model") || path.includes("generation/image-to-splat")) {
    return normalizeModelVersion(withFileFromInput(payload, "file"));
  }

  if (path.includes("generation/multiview-to-model")) {
    return normalizeModelVersion(withFilesFromInputs(payload));
  }

  if (path.includes("models/import")) {
    return withFileFromInput(payload, "file");
  }

  if (path.includes("animations/")) {
    const next = withOriginalModelTaskId(payload);
    if (path.includes("/rig")) normalizeRigModelVersion(next);
    return next;
  }

  return normalizeModelVersion(withOriginalModelTaskId(payload));
}

function buildImageTaskPayload(path, body, type) {
  const payload = normalizeEmpty({ ...body, type });

  if (path.includes("image-to-image")) {
    const next = withFileFromInput(payload, "file");
    return withFilesFromInputs(next);
  }

  if (path.includes("image-to-multiview")) {
    return withFileFromInput(payload, "file");
  }

  if (path.includes("edit-multiview")) {
    if (payload.input && !payload.original_task_id) payload.original_task_id = String(payload.input);
    delete payload.input;
    return payload;
  }

  return payload;
}

function normalizeModelVersion(payload) {
  if (payload.model && !payload.model_version) payload.model_version = payload.model;
  delete payload.model;
  return payload;
}

function normalizeRigModelVersion(payload) {
  if (!payload.model || payload.model_version) return payload;
  const selected = String(payload.model);
  payload.model_version = selected === "rig-v2.0" ? "v2.5-20260210" : selected === "rig-v1.0" ? "v1.0-20240301" : selected;
  delete payload.model;
  return payload;
}

function withOriginalModelTaskId(payload) {
  if (payload.input && !payload.original_model_task_id) payload.original_model_task_id = String(payload.input);
  delete payload.input;
  return payload;
}

function withFileFromInput(payload, field) {
  const input = payload.image_token || payload.file_token || payload.input;
  if (input && !payload[field]) payload[field] = fileRef(input);
  delete payload.image_token;
  delete payload.file_token;
  delete payload.input;
  return payload;
}

function withFilesFromInputs(payload) {
  if (!payload.inputs || payload.files) return payload;

  if (Array.isArray(payload.inputs)) {
    payload.files = payload.inputs.map(fileRef).filter(Boolean);
  } else if (typeof payload.inputs === "object") {
    payload.files = ["front", "left", "back", "right"]
      .map((key) => payload.inputs[key])
      .filter(Boolean)
      .map(fileRef);
  }

  delete payload.inputs;
  return payload;
}

function fileRef(value) {
  if (!value) return undefined;
  if (typeof value === "object") return value;
  const text = String(value).trim();
  if (!text) return undefined;
  if (/^https?:\/\//i.test(text)) return { type: fileType(text), url: text };
  return { type: fileType(text), file_token: text };
}

function fileType(value) {
  const clean = String(value).split("?")[0].split("#")[0].toLowerCase();
  const match = clean.match(/\.([a-z0-9]+)$/);
  if (!match) return "png";
  if (match[1] === "jpeg") return "jpg";
  return match[1];
}

function normalizeEmpty(input) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => {
      if (value === undefined || value === null || value === "") return false;
      if (Array.isArray(value) && value.length === 0) return false;
      return true;
    }),
  );
}

async function readJson(request) {
  const text = await request.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Expected JSON request body.");
  }
}

async function postTask(request, env, payload) {
  return forwardJsonToTripo(request, env, "/task", payload);
}

async function forwardJsonToTripo(request, env, path, payload) {
  const apiKey = tripoApiKey(request, env);
  if (!apiKey) return missingApiKey(request, env);

  const response = await fetch(upstreamUrl(env, path), {
    method: "POST",
    headers: {
      "accept": "application/json",
      "authorization": `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return withCors(request, env, response);
}

async function forwardToTripo(request, env, path) {
  const apiKey = tripoApiKey(request, env);
  if (!apiKey) return missingApiKey(request, env);

  const sourceUrl = new URL(request.url);
  const targetUrl = new URL(upstreamUrl(env, path));
  targetUrl.search = sourceUrl.search;

  const headers = new Headers();
  headers.set("authorization", `Bearer ${apiKey}`);
  headers.set("accept", request.headers.get("accept") || "application/json");
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);

  const hasBody = !["GET", "HEAD"].includes(request.method.toUpperCase());
  const response = await fetch(targetUrl, {
    method: request.method,
    headers,
    body: hasBody ? request.body : undefined,
  });

  return withCors(request, env, response);
}

async function downloadFile(request, env, value) {
  if (!value) return json(request, env, { error: { message: "url is required" } }, 400);

  let target;
  try {
    target = new URL(value);
  } catch {
    return json(request, env, { error: { message: "Invalid download URL" } }, 400);
  }

  if (!["http:", "https:"].includes(target.protocol)) {
    return json(request, env, { error: { message: "Only http and https downloads are allowed" } }, 400);
  }

  const response = await fetch(target, {
    headers: { accept: request.headers.get("accept") || "*/*" },
  });

  return withCors(request, env, response);
}

function missingApiKey(request, env) {
  return json(request, env, {
    error: {
      message: "Missing Tripo API key",
      hint: "Set TRIPO_API_KEY with wrangler secret put, or send x-api-key from the Studio API settings while testing.",
    },
  }, 401);
}

function tripoApiKey(request, env) {
  const secret = env.TRIPO_API_KEY || "";
  if (secret.trim()) return secret.trim();

  const authorization = request.headers.get("authorization") || "";
  if (/^bearer\s+/i.test(authorization)) return authorization.replace(/^bearer\s+/i, "").trim();

  const clientKey = request.headers.get("x-api-key") || "";
  return clientKey.trim();
}

function stripVersionPrefix(pathname) {
  let path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/v1") return "/";
  if (path.startsWith("/v1/")) path = path.slice(3);
  return path || "/";
}

function upstreamBase(env) {
  return (env.TRIPO_API_BASE_URL || DEFAULT_TRIPO_API_BASE_URL).replace(/\/+$/, "");
}

function upstreamUrl(env, path) {
  return `${upstreamBase(env)}/${String(path).replace(/^\/+/, "")}`;
}

function corsHeaders(request, env) {
  const origin = request.headers.get("origin") || "*";
  const allowList = String(env.ALLOWED_ORIGINS || "*")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const allowedOrigin = allowList.includes("*") || allowList.includes(origin) ? origin : allowList[0] || "*";

  return {
    "access-control-allow-origin": allowedOrigin,
    "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers": "Content-Type, Authorization, X-API-Key, X-Admin-Key",
    "access-control-max-age": "86400",
    "vary": "Origin",
  };
}

function withCors(request, env, response) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders(request, env))) headers.set(key, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function json(request, env, payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...corsHeaders(request, env),
    },
  });
}