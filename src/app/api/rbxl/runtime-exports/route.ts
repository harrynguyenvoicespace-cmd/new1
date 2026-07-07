export const dynamic = "force-static";

export async function GET() {
  return Response.json({ ok: true, exports: [] });
}

export async function POST() {
  return rbxlNativeUnavailable();
}

function rbxlNativeUnavailable() {
  return Response.json(
    {
      ok: false,
      error: "RBXL runtime export needs the native rbxl_tool backend and cannot run inside Cloudflare Workers.",
    },
    { status: 501 },
  );
}
