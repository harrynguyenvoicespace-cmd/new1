export async function POST() {
  return rbxlNativeUnavailable();
}

function rbxlNativeUnavailable() {
  return Response.json(
    {
      ok: false,
      error: "RBXL export needs the native rbxl_tool backend and cannot run inside Cloudflare Workers.",
    },
    { status: 501 },
  );
}
