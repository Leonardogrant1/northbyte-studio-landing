# Async Slide-Post-Jobs (n8n-helpers)

**Datum:** 2026-07-09
**Status:** Approved
**Betrifft:** `cloud-run/n8n-helpers`

## Problem

`POST /slide-posts/create` läuft ~9 Minuten (gemessen im Cloud-Run-Log vom
2026-07-09: Planung ~15s, danach 4 sequenzielle Bildgenerierungen à ~2–2,5 Min,
plus Uploads). Der n8n-HTTP-Request-Node bricht nach 300s mit `ECONNABORTED`
ab. Einen HTTP-Request 9+ Minuten offenzuhalten ist fragil; stattdessen wird
der Endpoint auf ein asynchrones Job-Pattern umgebaut.

## Cloud-Run-Randbedingungen

- **CPU-Throttling:** Nach gesendeter Response wird die CPU gedrosselt.
  Hintergrundarbeit muss deshalb als eigener, aktiver HTTP-Request laufen
  (Self-Request-Pattern). `timeoutSeconds: 3600` deckt die Laufzeit ab.
- **`containerConcurrency: 1`, `maxScale: 50`:** Jede Instanz bearbeitet genau
  einen Request. Der Self-Request landet dadurch automatisch auf einer anderen
  Instanz; Poll-Requests ebenso. In-Memory-Status funktioniert deshalb nicht —
  der Job-Status wird als JSON-Datei im bestehenden R2-Bucket `n8n-media`
  abgelegt (keine Datenbank nötig).

## Endpoints

### 1. `POST /slide-posts/create`

Body unverändert: `{ accountId, topic, dryRun? }`.

- Validierung bleibt synchron (Body-Checks, Account/Avatar aus Convex,
  `postizId`/`avatarId` vorhanden) → 400/404 sofort wie bisher.
- Erzeugt `jobId` (UUID), schreibt `slide-posts/jobs/<jobId>.json` mit
  `status: "queued"` in den Bucket.
- Feuert den Self-Request an den Worker-Endpoint (fire-and-forget mit kurzer
  Dispatch-Wartezeit ~500ms, damit der Request die Instanz sicher verlässt,
  bevor die CPU gedrosselt wird).
- Antwortet `202 { jobId }`.

### 2. `POST /slide-posts/jobs/:jobId/run` (interner Worker)

- Body: die bereits validierten Daten (`accountId`, `topic`, `dryRun`,
  Account- und Avatar-Objekte), damit nichts doppelt geladen werden muss.
- Führt die bestehende Pipeline unverändert aus (planSlides →
  generateSlideImages → R2 → Postiz → Slot → Convex).
- Updated die Job-JSON bei jedem Schritt (`running` + `step`), am Ende
  `done` mit dem bisherigen Response-Objekt als `result`, bei Fehlern
  `failed` mit `error`.
- Antwortet 200/500 (Antwort wird von niemandem konsumiert; sie hält nur den
  Request — und damit die CPU — am Leben).

### 3. `GET /slide-posts/jobs/:jobId`

- Liest `slide-posts/jobs/<jobId>.json` per S3-`GetObject` aus dem Bucket
  und gibt den Inhalt zurück; 404 wenn nicht vorhanden.
- Instanz-unabhängig, beliebig oft pollbar.

## Job-JSON

```json
{
  "jobId": "…",
  "status": "queued | running | done | failed",
  "step": "planning | slide-1 … slide-4 | uploading | postiz | scheduling | convex",
  "createdAt": 0,
  "updatedAt": 0,
  "result": { "postizPostId": "…", "convexPostId": "…", "scheduledAt": "…", "caption": "…", "slides": [], "mediaUrls": [] },
  "error": "…"
}
```

`result` nur bei `done` (bei `dryRun` das bisherige dryRun-Objekt),
`error` nur bei `failed`.

## Details & Fehlerbehandlung

- **Self-Request-URL:** aus dem `Host`-Header des eingehenden Requests
  (Cloud-Run-Service-URL), kein neuer Env-Var. `Authorization`-Header wird
  durchgereicht, damit die Auth-Middleware den Worker-Request akzeptiert.
- **Tote Jobs:** Stirbt eine Instanz mitten im Job, bleibt der Status auf
  `running`. n8n behandelt Jobs, deren `updatedAt` älter als ~15 Min ist,
  als fehlgeschlagen.
- **Fehler in der Pipeline:** landen als `failed` + Fehlermeldung in der
  Job-JSON (macht z. B. den offenen Postiz-Fehler sichtbar und debugbar).
- **Öffentliche Lesbarkeit:** Die Job-JSONs sind wie die Slides über die
  öffentliche Bucket-URL erreichbar, wenn man die UUID kennt — gleiche
  Exposure wie heute.

## n8n-Workflow (nachgelagert, manuell durch den User)

Create-Call (<1s, Node-Timeout kann auf Default bleiben) → Wait 30s →
`GET /slide-posts/jobs/:jobId` → If `done` → weiter; `failed` → Error-Pfad;
sonst zurück zum Wait. Zusätzlich Abbruchkriterium über `updatedAt` (>15 Min).

## Testen

- `dryRun: true` funktioniert weiter: Job läuft bis nach dem R2-Upload und
  endet mit `done` + dryRun-Result.
- Lokal (`pnpm dev`): Self-Request geht an `localhost:<port>`; lokal gibt es
  nur einen Prozess ohne Throttling, Verhalten identisch.
