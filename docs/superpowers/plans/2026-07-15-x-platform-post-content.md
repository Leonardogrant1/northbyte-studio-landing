# X (Twitter) Support für Post Content — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** X (Twitter) als dritte Plattform in Post Content via Postiz API, inkl. Toggle ob Medien angehängt werden.

**Architecture:** Folgt exakt dem bestehenden Muster für TikTok/Instagram: Platform-Union in Convex erweitern, Accounts-Seite um X-Option ergänzen, Post-Content-Seite bekommt ein `XSettings`-State-Objekt + rechte Settings-Spalte + einen Settings-Branch in `handleSchedule`. Der Postiz-Proxy (`/api/postiz/posts`) ist plattformagnostisch und bleibt unverändert.

**Tech Stack:** Next.js 15 (App Router, Client Components), Convex, Postiz Public API, Tailwind.

**Spec:** `docs/superpowers/specs/2026-07-15-x-platform-post-content-design.md`

## Global Constraints

- **KEINE git commits/pushes** — der User übernimmt alle Git-Operationen selbst. Commit-Schritte entfallen in allen Tasks.
- Es gibt kein Test-Setup für `apps/web` (kein test-Script). Verifikation läuft über `npx tsc --noEmit` pro Package + manuelle Prüfung. Kein Test-Framework hinzufügen (YAGNI).
- UI-Texte auf Deutsch, analog zu bestehenden Labels.
- Postiz-Settings-Format für X: `{ "__type": "x", "who_can_reply_post": "everyone", "community": "" }`.
- Der n8n-Lookup-Webhook wird für X unverändert aufgerufen (X-Scraping ergänzt der User separat in n8n — nicht Teil dieses Plans).

---

### Task 1: Convex-Backend — Platform `"x"` erlauben

**Files:**
- Modify: `packages/backend/convex/schema.ts:207`
- Modify: `packages/backend/convex/social_accounts/mutations.ts:6` und `:37`

**Interfaces:**
- Consumes: —
- Produces: `social_accounts.platform` akzeptiert `"tiktok" | "instagram" | "x"`. Die generierten Convex-Typen (`Doc<"social_accounts">.platform`) enthalten dann `"x"` — Tasks 2–4 hängen davon ab.

- [ ] **Step 1: Schema erweitern**

In `packages/backend/convex/schema.ts` (Zeile 207, Tabelle `social_accounts`):

```ts
// Vorher:
platform: v.union(v.literal("tiktok"), v.literal("instagram")),
// Nachher:
platform: v.union(v.literal("tiktok"), v.literal("instagram"), v.literal("x")),
```

Hinweis: Die `posts`-Tabelle (Zeile 247) enthält `"x"` bereits — dort nichts ändern.

- [ ] **Step 2: Mutations erweitern**

In `packages/backend/convex/social_accounts/mutations.ts` an ZWEI Stellen — `create` (Zeile 6) und `update` (Zeile 37) — identisch ändern:

```ts
// Vorher (beide Stellen):
platform: v.union(v.literal("tiktok"), v.literal("instagram")),
// Nachher (beide Stellen):
platform: v.union(v.literal("tiktok"), v.literal("instagram"), v.literal("x")),
```

- [ ] **Step 3: Typecheck Backend**

Run: `cd packages/backend && npx tsc --noEmit`
Expected: Exit-Code 0, keine Fehler.

---

### Task 2: Social-Accounts-Seite — X-Option + Badge

**Files:**
- Modify: `apps/web/src/app/admin/(dashboard)/social-accounts/page.tsx`

**Interfaces:**
- Consumes: Convex-Typen aus Task 1 (`platform` inkl. `"x"`).
- Produces: X-Accounts können über Add-/Edit-Modal angelegt und bearbeitet werden; `AccountCard` rendert X-Badge.

- [ ] **Step 1: Typ-Union erweitern**

Zeile 16 im `SocialAccount`-Typ:

```ts
// Vorher:
platform: "instagram" | "tiktok";
// Nachher:
platform: "instagram" | "tiktok" | "x";
```

- [ ] **Step 2: Add-Modal (Platform-State + Select)**

Zeile 77:

```ts
// Vorher:
const [platform, setPlatform] = useState<"instagram" | "tiktok">("tiktok");
// Nachher:
const [platform, setPlatform] = useState<"instagram" | "tiktok" | "x">("tiktok");
```

Zeile 139 (Select im Add-Modal) — Cast anpassen und Option ergänzen:

```tsx
// Vorher:
<select value={platform} onChange={(e) => { setPlatform(e.target.value as "instagram" | "tiktok"); setPreview(null); }} className={inputClass} disabled={loading}>
    <option value="tiktok">TikTok</option>
    <option value="instagram">Instagram</option>
</select>
// Nachher:
<select value={platform} onChange={(e) => { setPlatform(e.target.value as "instagram" | "tiktok" | "x"); setPreview(null); }} className={inputClass} disabled={loading}>
    <option value="tiktok">TikTok</option>
    <option value="instagram">Instagram</option>
    <option value="x">X</option>
</select>
```

- [ ] **Step 3: Edit-Modal (Select)**

Zeile 263:

```tsx
// Vorher:
<select value={platform} onChange={(e) => setPlatform(e.target.value as "instagram" | "tiktok")} className={inputClass} disabled={saving}>
    <option value="tiktok">TikTok</option>
    <option value="instagram">Instagram</option>
</select>
// Nachher:
<select value={platform} onChange={(e) => setPlatform(e.target.value as "instagram" | "tiktok" | "x")} className={inputClass} disabled={saving}>
    <option value="tiktok">TikTok</option>
    <option value="instagram">Instagram</option>
    <option value="x">X</option>
</select>
```

- [ ] **Step 4: AccountCard — Gradient, Badge-Farbe, Icon**

In `AccountCard` (ab Zeile 449). Nach Zeile 451 (`const isTikTok = ...`) ergänzen:

```ts
const isX = account.platform === "x";
```

`borderGradientClass` (Zeile 454–458) um X-Branch erweitern:

```ts
const borderGradientClass = isInstagram
    ? "bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7]"
    : isTikTok
    ? "bg-gradient-to-tr from-[#00f2fe] via-[#fe2c55] to-[#f63a79]"
    : isX
    ? "bg-gradient-to-tr from-neutral-100 via-neutral-500 to-neutral-900"
    : "bg-gradient-to-tr from-accent-blue to-accent";
```

`platformBadgeClass` (Zeile 460–462) von binär auf dreifach umstellen:

```ts
const platformBadgeClass = isInstagram
    ? "text-pink-400 bg-pink-500/10 border border-pink-500/20"
    : isTikTok
    ? "text-cyan-400 bg-cyan-500/10 border border-cyan-500/20"
    : "text-neutral-200 bg-neutral-500/10 border border-neutral-400/20";
```

Im Platform-Badge (nach dem TikTok-SVG, Zeile 497–501) das X-Logo ergänzen:

```tsx
{isX && (
    <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 24 24">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117l11.966 15.644z" />
    </svg>
)}
```

- [ ] **Step 5: Typecheck Web**

Run: `cd apps/web && npx tsc --noEmit`
Expected: Exit-Code 0, keine Fehler.

---

### Task 3: Post-Content-Seite — XSettings-State, Validierung, Settings-Branch, Medien pro Account

**Files:**
- Modify: `apps/web/src/app/admin/(dashboard)/post-content/page.tsx`

**Interfaces:**
- Consumes: Convex-Typen aus Task 1; bestehender Proxy `POST /api/postiz/posts` (Body-Felder `integrationId`, `postizMedia`, `content`, `settings`, `scheduledAt`).
- Produces: `XSettings`-Interface + `xSettings`/`setXSettings`-State + `hasX`-Flag — Task 4 (UI-Panel) nutzt genau diese Namen.

- [ ] **Step 1: XSettings-Interface + Default**

Nach `defaultInstagramSettings` (Zeile 55) einfügen:

```ts
interface XSettings {
    who_can_reply_post: "everyone" | "following" | "mentionedUsers" | "verified" | "subscribers";
    includeMedia: boolean;
}

const defaultXSettings: XSettings = {
    who_can_reply_post: "everyone",
    includeMedia: true,
};
```

- [ ] **Step 2: State + hasX**

Nach der Zeile mit `instagramSettings`-State (Zeile 127):

```ts
const [xSettings, setXSettings] = useState<XSettings>(defaultXSettings);
```

Nach `hasInstagram` (Zeile 137):

```ts
const hasX = selectedAccounts.some((a) => a.platform === "x");
```

- [ ] **Step 3: Medien-Pflicht lockern**

In `handleSchedule` (Zeile 185–188):

```ts
// Vorher:
if (mediaFiles.length === 0) {
    toast.error("Bitte mindestens eine Datei auswählen.");
    return;
}
// Nachher:
const mediaRequired = selectedAccounts.some(
    (a) => a.platform !== "x" || xSettings.includeMedia
);
if (mediaRequired && mediaFiles.length === 0) {
    toast.error("Bitte mindestens eine Datei auswählen.");
    return;
}
```

(Nur-X-Auswahl mit `includeMedia: false` darf ohne Dateien posten; die R2-/Postiz-Upload-Schleifen laufen dann leer durch.)

- [ ] **Step 4: Settings-Branch für X**

In `handleSchedule`, im Platform-Branch (Zeile 259–280), vor dem finalen `else` einfügen:

```ts
} else if (account.platform === "x") {
    settings = {
        __type: "x",
        who_can_reply_post: xSettings.who_can_reply_post,
        community: "",
    };
}
```

- [ ] **Step 5: Medien pro Account (X-Toggle anwenden)**

Direkt nach dem `settings`-Branch (vor dem `fetch("/api/postiz/posts", ...)`, Zeile 282):

```ts
const excludeMedia = account.platform === "x" && !xSettings.includeMedia;
const accountPostizMedia = excludeMedia ? [] : postizMedia;
const accountMediaUrls = excludeMedia ? [] : r2Urls;
```

Im `fetch`-Body `postizMedia` ersetzen:

```ts
body: JSON.stringify({
    integrationId: account.postizId,
    postizMedia: accountPostizMedia,
    content,
    settings,
    scheduledAt,
}),
```

Im `createPost`-Aufruf (Zeile 297–305) `mediaUrls` ersetzen:

```ts
mediaUrls: accountMediaUrls,
```

(`posts.mutations.create` erwartet `mediaUrls: v.array(v.string())` — leeres Array ist gültig.)

- [ ] **Step 6: State-Reset nach Erfolg**

Im Erfolgs-Block (nach `setInstagramSettings(defaultInstagramSettings);`, Zeile 319):

```ts
setXSettings(defaultXSettings);
```

- [ ] **Step 7: Typecheck Web**

Run: `cd apps/web && npx tsc --noEmit`
Expected: Exit-Code 0. Hinweis: `xSettings` wird erst in Task 4 im JSX genutzt — falls tsc `noUnusedLocals` meldet, ist das nach Task 4 behoben (Tasks 3+4 im Zweifel gemeinsam typechecken).

---

### Task 4: Post-Content-Seite — X-Settings-Panel (rechte Spalte)

**Files:**
- Modify: `apps/web/src/app/admin/(dashboard)/post-content/page.tsx`

**Interfaces:**
- Consumes: `hasX`, `xSettings`, `setXSettings`, `XSettings`, `Toggle`-Komponente, `inputClass`, `isScheduling` aus Task 3 / Bestand.
- Produces: Sichtbares X-Panel, analog zu TikTok/Instagram.

- [ ] **Step 1: Panel einfügen**

Nach dem schließenden `)}`-Block des Instagram-Panels (Zeile 697), vor dem schließenden `</div>` der Flex-Row:

```tsx
{/* X Settings */}
{hasX && (
    <div className="w-72 flex-shrink-0 sticky top-6 space-y-3">
        <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-secondary">
                X
            </h2>
            <span className="text-xs text-secondary/60">Alle X-Accounts</span>
        </div>
        <div className="rounded-xl border border-border bg-surface2 p-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-primary">Medien anhängen</span>
                <Toggle
                    checked={xSettings.includeMedia}
                    onChange={(v) => setXSettings((s) => ({ ...s, includeMedia: v }))}
                />
            </div>
            <div className="space-y-1">
                <label className="text-xs font-medium text-secondary">Wer kann antworten</label>
                <select
                    value={xSettings.who_can_reply_post}
                    onChange={(e) =>
                        setXSettings((s) => ({
                            ...s,
                            who_can_reply_post: e.target.value as XSettings["who_can_reply_post"],
                        }))
                    }
                    className={inputClass}
                    disabled={isScheduling}
                >
                    <option value="everyone">Alle</option>
                    <option value="following">Follower</option>
                    <option value="mentionedUsers">Erwähnte Nutzer</option>
                    <option value="verified">Verifizierte</option>
                    <option value="subscribers">Abonnenten</option>
                </select>
            </div>
        </div>
    </div>
)}
```

- [ ] **Step 2: Typecheck Web**

Run: `cd apps/web && npx tsc --noEmit`
Expected: Exit-Code 0, keine Fehler.

- [ ] **Step 3: Manuelle Verifikation (Dev-Server)**

Run: `cd apps/web && pnpm dev`

Prüfen:
1. `/admin/social-accounts` → „Account hinzufügen": Platform-Select zeigt „X"; Edit-Modal ebenso; X-Account-Karte zeigt neutrales Badge mit X-Logo.
2. `/admin/post-content`: X-Account auswählen → rechte Spalte „X" erscheint mit Medien-Toggle (default an) und Reply-Select.
3. Medien-Toggle aus + NUR X-Account gewählt → Submit ohne Dateien möglich (kein „Bitte mindestens eine Datei auswählen").
4. Medien-Toggle aus + zusätzlich Instagram/TikTok gewählt → Dateien weiterhin Pflicht.
5. (Optional, echter Postiz-Call) Post mit X-Account absetzen → Request an `/api/postiz/posts` enthält `settings: { __type: "x", who_can_reply_post: ..., community: "" }` und bei Toggle aus `postizMedia: []`.
