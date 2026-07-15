# X (Twitter) Support für Post Content — Design

**Datum:** 2026-07-15
**Status:** Approved

## Ziel

Die Post-Content-Seite unterstützt aktuell nur TikTok und Instagram. X (Twitter) soll als dritte Plattform hinzukommen — via Postiz API (`__type: "x"`). Da auf X oft ohne Medien gepostet wird, gibt es für X einen Toggle, ob Medien angehängt werden.

## Kontext

- Posts laufen über den Proxy `apps/web/src/app/api/postiz/posts/route.ts` → Postiz `POST /public/v1/posts`. Der Proxy ist plattformagnostisch (nimmt `settings` durch) — **keine Änderung nötig**.
- Postiz-Settings für X laut API-Doku:
  ```json
  { "__type": "x", "who_can_reply_post": "everyone", "community": "" }
  ```
- Die `posts`-Tabelle in Convex kennt `"x"` bereits; `social_accounts` nicht.
- Der Account-Lookup-Webhook (n8n) wird für X unverändert aufgerufen; X-Scraping wird separat im n8n-Workflow ergänzt (nicht Teil dieser Arbeit).

## Änderungen

### 1. Convex-Backend

- `packages/backend/convex/schema.ts`: `social_accounts.platform` Union um `v.literal("x")` erweitern.
- `packages/backend/convex/social_accounts/mutations.ts`: dieselbe Union in `create` (Zeile 6) und `update` (Zeile 37).

### 2. Social-Accounts-Seite (`apps/web/src/app/admin/(dashboard)/social-accounts/page.tsx`)

- Platform-Typ-Unions `"instagram" | "tiktok"` um `"x"` erweitern (Interface, beide Modals).
- `<option value="x">X</option>` in beiden Platform-Selects (Add + Edit).
- Lookup-Webhook unverändert auch für X aufrufen.
- Platform-Badge/Ring für X: neutral schwarz/weiß, analog zu bestehenden Badges.

### 3. Post-Content-Seite (`apps/web/src/app/admin/(dashboard)/post-content/page.tsx`)

- Neues Settings-Interface + State:
  ```ts
  interface XSettings {
      who_can_reply_post: "everyone" | "following" | "mentionedUsers" | "verified" | "subscribers";
      includeMedia: boolean; // default: true
  }
  ```
- `hasX` analog zu `hasTikTok`/`hasInstagram`.
- Neue rechte Spalte „X" (sichtbar wenn `hasX`):
  - Toggle **„Medien anhängen"** (`includeMedia`)
  - Select **„Wer kann antworten"**: Alle / Follower / Erwähnte / Verifizierte / Abonnenten
- Settings-Branch in `handleSchedule`:
  ```ts
  settings = { __type: "x", who_can_reply_post: xSettings.who_can_reply_post, community: "" };
  ```
- **Medien pro Account:** Für X-Accounts mit `includeMedia: false` wird `postizMedia: []` an den Proxy gesendet und `mediaUrls` im Convex-Post weggelassen. Andere Plattformen unverändert.
- State-Reset nach Erfolg: `xSettings` auf Default zurücksetzen.

### 4. Validierung

- Bisher: `mediaFiles.length === 0` blockt jede Submission.
- Neu: Medien sind nur Pflicht, wenn mindestens ein ausgewählter Account sie braucht — d.h. ein Nicht-X-Account ist gewählt ODER X mit `includeMedia: true`. Nur-X mit `includeMedia: false` → Submission ohne Dateien erlaubt (Upload-Schleifen laufen leer).

## Fehlerbehandlung

Wie bisher: Toasts bei Fehlern, Proxy gibt Postiz-Fehlertext durch. Keine neuen Fehlerpfade.

## Nicht im Scope

- X-Scraping im n8n-Lookup-Workflow (macht der User selbst).
- `community`-Feld als UI (wird fest leer gesendet).
- Threads / Multi-Tweet-Posts.
