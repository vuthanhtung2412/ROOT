# `@root/web-client`

Generated typed HTTP client for `@root/web` OpenAPI.

## Generate

From repo root (after API shape changes):

```bash
pnpm --filter @root/web gen:openapi
pnpm gen:api-client
```

Writes `src/schema.d.ts` from `backend/web/openapi.json` (or live `ROOT_API/doc`).

## Use from a frontend

```ts
import { createRootWebClient } from '@root/web-client'

const api = createRootWebClient({ baseUrl: 'http://localhost:3000' })
const { data, error } = await api.GET('/game')
```

Add dependency:

```json
"@root/web-client": "workspace:*"
```
