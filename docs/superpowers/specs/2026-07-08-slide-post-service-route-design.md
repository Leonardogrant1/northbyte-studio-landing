# Slide-Post-Route in n8n-helpers — Design

**Datum:** 2026-07-08
**Service:** `cloud-run/n8n-helpers`

## Ziel

Eine Route `POST /slide-posts/create`, die aus `{ accountId, topic }` einen fertigen
TikTok-Slide-Post erzeugt: 4 Bilder generieren (Logik aus
`apps/web/test-scripts/tiktok-slide-post.ts`), nach R2 hochladen, bei Postiz
hochladen, auf den nächsten freien postingTime-Slot schedulen und den Post in
Convex eintragen. Aufrufer ist n8n.

## Request / Response

```
POST /slide-posts/create        (Bearer-Auth via bestehender authMiddleware)
{ "accountId": "<social_accounts-Id>", "topic": "...", "dryRun": false }
```

Antwort: `{ postizPostId, scheduledAt, caption, slides: [{text, sceneDescription}], mediaUrls }`.
`dryRun: true` → stoppt nach R2-Upload (kein Postiz, kein Convex-Post, kein Scheduling);
Antwort enthält caption/slides/mediaUrls.

## Ablauf

1. **Account laden:** `generic.queries.getById(accountId)` via `ConvexHttpClient`
   (`CONVEX_URL`-Env). Validierung: `postizId` und `avatarId` müssen am Account
   gesetzt sein, sonst 400. `postingTimes`/`timezone` für das Scheduling.
   Avatar via `getById(avatarId)` → `imageUrl` (Referenzfoto), `description`.
2. **Slides generieren** (Port des Test-Scripts): gpt-5.5 plant per Structured
   Output Caption + genau 4 Slides (Hook, 2× Content, reiner CTA). Danach 4
   verkettete `image_generation`-Calls (`previous_response_id`, 1024x1536,
   quality high): Call 1 mit Avatar-Foto als Referenz, letzter Call mit
   `store_entry.png` (App-Store-Screenshot, liegt als Asset im Service) und
   Platzierungs-Anweisung. Der jemp-App-Kontext ist fest im Service hinterlegt.
3. **R2-Upload:** `slide-posts/<runId>/slide-N.png` über den bestehenden
   `r2Client` → öffentliche URLs (`R2_PUBLIC_URL`).
4. **Postiz-Upload:** pro Bild `POST {POSTIZ_BASE_URL}/upload-from-url` →
   Media `{id, path}` (gleicher Weg wie die Web-App).
5. **Slot berechnen:** `posts.queries.getLastScheduledByAccount(accountId, 10)` +
   Port von `getNextScheduleTime` aus `apps/web/src/lib/schedule.ts`
   (postingTimes + timezone; rechnet gegen die zuletzt geplanten Posts, dadurch
   werden belegte Slots übersprungen). Keine postingTimes → sofort posten.
6. **Postiz-Post:** `POST {POSTIZ_BASE_URL}/posts`, type `schedule` (bzw. `now`),
   `integration: { id: account.postizId }`, content = Caption, image = Media-Array,
   TikTok-Settings wie Web-App-Defaults (`__type: "tiktok"`,
   `privacy_level: PUBLIC_TO_EVERYONE`, duet/stitch/comment true,
   `autoAddMusic: "no"`, `content_posting_method: DIRECT_POST`).
7. **Convex-Post anlegen:** Neue Mutation `posts.mutations.createFromService`
   in `packages/backend`: Args wie `create` + `internalKey`, geprüft gegen
   `INTERNAL_API_SECRET` (Convex-Deployment-Env). `createdBy` =
   `account.assignedTo`, sonst erster User mit `type: "admin"`.
   Felder: title = topic, description = caption, mediaUrls = R2-URLs,
   platform = account.platform, postizPostId, scheduledAt (ms), status "scheduled".

## Fehlerverhalten

- 400: accountId/topic fehlt, Account ohne postizId/avatarId, Avatar nicht gefunden
- 404: Account nicht gefunden
- 502 mit Fehlertext: Postiz-/OpenAI-/Convex-Fehler (Route ist synchron, kein Retry;
  n8n sieht den Fehler und kann selbst retryen)
- Route läuft ~3–5 min synchron — n8n-HTTP-Node braucht hohen Timeout
  (Cloud-Run-Timeout steht bereits auf 3600s, concurrency 1)

## Nebenarbeiten

- `packages/tsconfig` anlegen mit `cloud-functions.json` — n8n-helpers und
  vertex-ai referenzieren `"tsconfig": "workspace:*"` aus dem alten Repo;
  ohne das Package schlägt `pnpm install` im Monorepo fehl.
- n8n-helpers: `openai` v4 → v6 (Responses API), `convex` als Dep ergänzen.
- Env-Erweiterung in `.env`, `.env.example`, `.env.yaml`: `CONVEX_URL`,
  `POSTIZ_API_KEY`, `POSTIZ_BASE_URL`, `INTERNAL_API_SECRET`.
  `INTERNAL_API_SECRET` zusätzlich als Convex-Deployment-Env setzen.
- Asset `store_entry.png` in den Service kopieren (Quelle:
  `apps/web/test-scripts/store_entry.png`); esbuild/Docker müssen es mitnehmen.

## Nicht im Scope

- Multi-App-Support (CTA/Store-Screenshot sind jemp-fest)
- Async-Verarbeitung/Job-Queue
- Absicherung der bestehenden öffentlichen `generic.queries` (bekanntes Thema,
  separat angehen)

## Verifikation

1. `pnpm install` läuft mit `cloud-run/*` im Workspace fehlerfrei
2. `pnpm --filter n8n-helpers type-check` und `build` (esbuild) grün
3. Server lokal starten: `/health` 200, Route ohne Body → 400,
   unbekannte accountId → 404
4. Optionaler manueller `dryRun`-Test mit echtem Account (kostet OpenAI-Credits)
