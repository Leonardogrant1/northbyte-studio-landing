# Turborepo-Migration — Design

**Datum:** 2026-07-08

## Ziel

Das bestehende Single-App-Repo (Next.js + Convex) wird ein Turborepo-Monorepo mit
pnpm-Workspaces, damit neben der Web-App weitere Micro-Services (z.B. Cloud Run)
Platz haben und Convex von App und Services gemeinsam genutzt werden kann.

## Zielstruktur

```
northbyte_studio/
├── package.json           Root: private, nur turbo; Scripts dev/build/lint via turbo
├── pnpm-workspace.yaml    apps/*, packages/*, services/*
├── turbo.json             Tasks: build (Cache, outputs .next/**), dev (persistent), lint
├── apps/
│   └── web/               bestehende Next.js-App 1:1 verschoben:
│                          src/, public/, next.config.mjs, tailwind.config.ts,
│                          postcss.config.mjs, tsconfig.json, next-env.d.ts,
│                          .env / .env.local (lokal, gitignored), .clerk/,
│                          test-scripts/ (inkl. store_entry.png)
│                          package.json: bisherige Deps + "@repo/backend": "workspace:*"
├── packages/
│   └── backend/           Convex als Package "@repo/backend":
│                          convex/ (schema, functions, _generated),
│                          package.json (convex + @convex-dev/migrations),
│                          .env.local (CONVEX_DEPLOYMENT, NEXT_PUBLIC_CONVEX_URL)
└── services/              README.md-Platzhalter; als Workspace-Pfad registriert,
                           Cloud-Run-Services kommen später hier rein
```

## Entscheidungen

- **Package Manager:** pnpm (stand bereits als `packageManager` in package.json);
  package-lock.json wird gelöscht, pnpm-lock.yaml neu erzeugt.
- **Convex als eigenes Package** (`@repo/backend`), damit spätere Services die
  generierte API importieren können. Kein `exports`-Feld → Deep-Imports erlaubt.
- **Import-Normalisierung:** Alle bisherigen Varianten (`@/convex/*`, `@/../convex/*`,
  relative Pfade) werden zu `@repo/backend/convex/_generated/api` bzw. `.../dataModel`.
  npm-Imports wie `convex/react`, `convex/browser` bleiben unverändert.
  Der tsconfig-Alias `@/convex/*` entfällt; `transpilePackages: ["@repo/backend"]`
  kommt in next.config.mjs.
- **test-scripts/** ziehen nach `apps/web/test-scripts/` (nutzen die Web-Deps) und
  importieren die Convex-API über `@repo/backend`.
- **Nicht angefasst:** eas.json, MP4-Dateien, Debug-Skripte im Root
  (test-postiz.mjs, test-local.mjs, test-filetype.mjs, test.js), docs/, .claude/.
- **Gelöscht (Build-Artefakte):** .next/, tsconfig.tsbuildinfo, node_modules/,
  package-lock.json. *.tsbuildinfo kommt in die .gitignore.

## Workflows nach der Migration

- `pnpm dev` (Root) → turbo → `next dev` in apps/web
- `pnpm build` (Root) → turbo → `next build` in apps/web
- `pnpm --filter @repo/backend dev` → `convex dev`
- Test-Scripts: `cd apps/web && npx tsx test-scripts/tiktok-slide-post.ts "<Thema>"`

## Manuelle Schritte (User)

- Git-Commit der Migration (User macht alle Git-Operationen selbst)
- Falls Vercel-Deployment: Root Directory im Dashboard auf `apps/web` umstellen

## Verifikation

1. `pnpm install` läuft fehlerfrei durch
2. `pnpm build` (voller Next-Build) läuft fehlerfrei durch
3. Keine verbleibenden Alt-Imports (`@/convex/`, `@/../convex/`, relative convex-Pfade)
