Backend code is grouped by API endpoint.

- `api/<endpoint>/route.ts` contains the actual server handler logic.
- `src/app/api/.../route.ts` stays as the Next.js routing adapter so public API URLs do not change.
