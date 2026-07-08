# Services

Micro-Services des Monorepos (z.B. Cloud-Run-Services).

Jeder Service bekommt hier einen eigenen Ordner mit eigener `package.json`
(der Pfad `services/*` ist in `pnpm-workspace.yaml` bereits als Workspace
registriert). Auf Convex zugreifen können Services über das Workspace-Package
`@repo/backend`:

```json
{ "dependencies": { "@repo/backend": "workspace:*" } }
```

```ts
import { api } from "@repo/backend/convex/_generated/api";
```
