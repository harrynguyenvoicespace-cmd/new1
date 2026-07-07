# Tripo Cloudflare API

This Worker is the Tripo proxy used by the Studio frontend.

Public root:

```text
https://tripo-cloudflare-api.harrynguyenvoicespace.workers.dev/v1
```

Local dev:

```bash
npm run tripo:dev
```

Set the real Tripo key as a Cloudflare secret before deploying:

```bash
npx wrangler secret put TRIPO_API_KEY --config cloudflare/tripo-api/wrangler.jsonc
```

Deploy:

```bash
npm run tripo:deploy
```

The frontend reads `NEXT_PUBLIC_TRIPO_API_ROOT_URL` first, then falls back to `NEXT_PUBLIC_API_ROOT_URL`, then the public Worker URL above.