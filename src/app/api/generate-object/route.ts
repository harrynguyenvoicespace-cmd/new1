export const dynamic = "force-static";
export const maxDuration = 30;

const vector3Prompt = `
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

type GenerateObjectBody = {
  prompt?: string;
  model?: "gpt-5" | "gpt-5-mini" | "gpt-5-nano" | "grok-4";
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as GenerateObjectBody;
  const prompt = String(body.prompt || "").slice(0, 800);
  const apiKey = process.env.XAI_API_KEY;

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
            content: `You are a 3D mesh generator. ${vector3Prompt}`,
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
    const message = error instanceof Error ? error.message : "generate_object_failed";
    return ndjson({ error: message }, 500);
  }
}

function ndjson(payload: unknown, status = 200) {
  return new Response(`${JSON.stringify(payload)}\n`, {
    status,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
