import { streamObject } from "ai";
import { xai } from "@ai-sdk/xai";
import { z } from "zod";

const vector3 = z.object({ x: z.number(), y: z.number(), z: z.number() });
const colorSchema = z.union([
  z.object({
    r: z.number().int().min(0).max(255),
    g: z.number().int().min(0).max(255),
    b: z.number().int().min(0).max(255),
  }),
  z.string().regex(/^#?[0-9a-fA-F]{6}$/),
  vector3,
]);

const meshSchema = z.object({
  mesh: z.object({
    name: z.string().optional(),
    vertices: z.array(vector3).default([]),
    faces: z.array(z.array(z.number()).min(3).max(4)).default([]),
    material: z
      .object({
        color: colorSchema.optional(),
        roughness: z.number().min(0).max(1).optional(),
        metalness: z.number().min(0).max(1).optional(),
        emissive: colorSchema.optional(),
        emissiveIntensity: z.number().min(0).max(1).optional(),
        opacity: z.number().min(0).max(1).optional(),
        transparent: z.boolean().optional(),
      })
      .optional(),
  }),
});

type GenerateObjectBody = {
  prompt?: string;
  model?: "gpt-5" | "gpt-5-mini" | "gpt-5-nano" | "grok-4";
  detail?: "low" | "medium" | "high";
  maxVertices?: number;
  style?: string;
};

export async function POST(req: Request) {
  const body: GenerateObjectBody = await req.json().catch(() => ({}));
  const userPrompt = (body.prompt || "").slice(0, 800);
  const model = xai("grok-4-0709");

  const systemInstructions = `
You are a 3D mesh generator specializing in high-fidelity, realistic models. Output ONLY a JSON object that matches the schema.

Rules:
- Provide a concise, descriptive mesh.name, for example "Ancient Oak Tree with Bark Texture Details" or "Ergonomic Modern Office Chair".
- Aim for detail: incorporate surface variations, organic asymmetry, or precise engineered forms when relevant.
- Use realistic proportions, scales, and architecture based on real-world references.
- Optimize topology for quality: favor quads for smooth surfaces; use triangles only where necessary; avoid self-intersections and holes.
- Target a useful vertex count for the requested detail while keeping the model practical.
- Use 0-based indices in faces.
- Center the mesh at the origin and normalize scale to fit within a unit bounding box unless the request specifies otherwise.
- Ensure symmetry where logically appropriate.
- Do not include extra narration, metadata, or prose. Only output the JSON object that matches the schema.

User request: ${userPrompt}
`;

  const { partialObjectStream } = streamObject({
    model,
    schema: meshSchema,
    prompt: systemInstructions,
    temperature: 0.2,
  });

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        for await (const partial of partialObjectStream) {
          controller.enqueue(encoder.encode(`${JSON.stringify(partial)}\n`));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "stream_error";
        controller.enqueue(encoder.encode(`${JSON.stringify({ error: message })}\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}