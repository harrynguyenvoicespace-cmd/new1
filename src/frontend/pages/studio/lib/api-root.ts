export const defaultStudioApiRoot = "https://tripo-cloudflare-api.harrynguyenvoicespace.workers.dev/v1";

export function studioApiRoot() {
  return (
    process.env.NEXT_PUBLIC_TRIPO_API_ROOT_URL ||
    process.env.NEXT_PUBLIC_API_ROOT_URL ||
    defaultStudioApiRoot
  ).replace(/\/$/, "");
}