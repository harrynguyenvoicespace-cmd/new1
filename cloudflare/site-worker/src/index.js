const VECTOR3_PROMPT = `
Return only JSON in this shape:
{
  "mesh": {
    "name": "short name",
    "vertices": [{ "x": 0, "y": 0, "z": 0 }],
    "faces": [[0, 1, 2]],
    "material": {
      "color": "#c8c8d2",
      "roughness": 0.8,
      "metalness": 0.05
    }
  }
}
Use 0-based face indices. Keep the mesh practical and centered near the origin.
`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS" && url.pathname.startsWith("/api/")) {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    if (url.pathname === "/api/generate-object" && request.method === "POST") {
      return generateObject(request, env);
    }

    if (url.pathname.startsWith("/api/rbxl/")) {
      return json(
        {
          error: "RBXL native backend is split out of this Cloudflare Worker.",
          hint: "Deploy the RBXL tool as a separate Node/native backend, then point the UI to that backend.",
        },
        501,
      );
    }

    if (url.pathname.startsWith("/api/")) {
      return json({ error: "Unsupported API route." }, 404);
    }

    return env.ASSETS.fetch(request);
  },
};

async function generateObject(request, env) {
  const body = await request.json().catch(() => ({}));
  const prompt = String(body.prompt || "").slice(0, 800);
  const apiKey = env.XAI_API_KEY;

  if (!apiKey) {
    return ndjson({ error: "Missing XAI_API_KEY Cloudflare secret." }, 500);
  }

  try {
    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "grok-4-0709",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are a 3D mesh generator. ${VECTOR3_PROMPT}`,
          },
          {
            role: "user",
            content: prompt || "Create a simple low-poly cube.",
          },
        ],
      }),
    });

    if (!response.ok) {
      return ndjson({ error: `xAI request failed with HTTP ${response.status}.` }, response.status);
    }

    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    const mesh = typeof content === "string" ? JSON.parse(content) : content;
    return ndjson(mesh);
  } catch (error) {
    return ndjson({ error: error instanceof Error ? error.message : "generate_object_failed" }, 500);
  }
}

function ndjson(payload, status = 200) {
  return new Response(`${JSON.stringify(payload)}\n`, {
    status,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache",
      ...corsHeaders(),
    },
  });
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(),
    },
  });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
  };
}
