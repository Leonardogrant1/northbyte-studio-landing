# User-Attachments im Adminpanel — Design

**Datum:** 2026-07-16
**Status:** Approved (Design-Review durch Leonardo)

## Ziel

Admins können auf der bestehenden Users-Page (`/admin/users`) Dateien an einen User anhängen — primärer Use-Case: unterschriebene Affiliate-Verträge (PDF) ablegen. Kein Vertrags-Builder, keine neue Seite, keine Vertragslogik. Der HTML-Vertragsentwurf (`affiliate-vertrag.html` im Repo-Root) wird weiterhin manuell ausgefüllt, als PDF gedruckt und hier hochgeladen.

## Scope

- Upload beliebiger Dateien pro User (PDFs, Bilder etc.), Liste, Download, Löschen — nur für Admins.
- **Nicht** im Scope: Vertragsdaten/Konditionen in der DB, Vertragsnummern, Status-Lifecycle, Sichtbarkeit für den User selbst, eigene Subpage.

## Schema (Convex)

Neue Tabelle in `packages/backend/convex/schema.ts`:

```ts
user_attachments: defineTable({
    userId: v.id("users"),
    fileName: v.string(),      // Original-Dateiname, z.B. "affiliate-vertrag-signiert.pdf"
    fileKey: v.string(),       // R2-Objekt-Key
    fileUrl: v.string(),       // Public-Download-URL (beim Upload gespeichert, spart Client-Env-Var)
    fileType: v.string(),      // MIME-Type
    fileSize: v.number(),      // Bytes
    uploadedAt: v.number(),
}).index("by_user", ["userId"]),
```

## Backend (Convex)

Neues Verzeichnis `packages/backend/convex/user_attachments/`:

- `queries.ts`
  - `getByUserId({ userId })` — Liste der Attachments eines Users.
  - `getCountsByUser()` — Map userId → Anzahl, für die Badge-Anzeige in der User-Tabelle (eine Query statt N).
- `mutations.ts`
  - `create({ userId, fileName, fileKey, fileType, fileSize })` — nach erfolgreichem R2-Upload aufgerufen.
  - `remove({ attachmentId })` — löscht den DB-Eintrag; das R2-Objekt wird clientseitig über die bestehende `/api/r2/delete`-Route entfernt.

Alle Funktionen mit serverseitigem Admin-Check (`type === "admin"`), nach dem Muster der bestehenden admin-only Queries (z.B. `users/queries.ts#getAllUsers`).

## Storage (R2)

- Bucket: **`northbyte-media`** (existiert bereits in Cloudflare), Public-URL: **`https://media.northbyte.studio`**.
- `apps/web/src/lib/r2-constants.ts`: Enum-Eintrag `northbyte = "northbyte-media"` ergänzen.
- `apps/web/src/lib/r2.ts`: Eintrag in `R2_PUBLIC_URLS` über neue Env-Var `R2_NORTHBYTE_PUBLIC_URL=https://media.northbyte.studio` (in `.env` ergänzen, analog zu `R2_N8N_PUBLIC_URL`).
- Key-Schema: `user-attachments/{userId}/{timestamp}-{fileName}`.
- Upload: bestehendes Presigned-URL-Pattern (`POST /api/r2/upload-url` → PUT direkt zu R2), wie auf der Post-Content-Page.
- Download: Public-URL via `getPublicUrl()` (Bucket ist öffentlich angebunden). Hinweis: Verträge enthalten personenbezogene Daten — die Keys sind nicht erratbar, aber wer die URL kennt, kann die Datei abrufen (Lese-Exposure bewusst akzeptiert, interner Admin-Workflow). Schreib-/Lösch-Zugriff auf den Bucket ist dagegen NICHT offen: Upload-URL- und Delete-Route erzwingen für `northbyte-media` serverseitig Admin-Rechte (`isCurrentUserAdmin()` in `apps/web/src/lib/is-admin.ts`); Automation mit `NORTHBYTE_API_KEY` ist ausgenommen. `getPublicUrl()` wirft bei fehlender Bucket-URL-Konfiguration, statt still auf eine falsche Domain zurückzufallen — so kann nie eine kaputte `fileUrl` persistiert werden.
- Löschen: bestehende `/api/r2/delete`-Route + `remove`-Mutation.

## UI (Users-Page)

`apps/web/src/app/admin/(dashboard)/users/page.tsx`:

- Pro User-Zeile ein Büroklammer-Icon-Button (lucide `Paperclip`) mit Anzahl-Badge, wenn Attachments existieren.
- Klick öffnet `UserAttachmentsModal` (neue Komponente unter `apps/web/src/components/admin/`, Muster: `AffiliateEditModal`):
  - Liste: Dateiname, Größe (formatiert), Upload-Datum; je Eintrag Download- und Löschen-Button (Löschen mit Bestätigung).
  - Upload: Dateiauswahl + Drag & Drop, Fortschrittsanzeige während des PUT, danach `create`-Mutation.
  - Fehler-Feedback über sonner-Toasts, wie auf der Users-Page üblich.

## Fehlerbehandlung

- Schlägt der R2-Upload fehl, wird keine `create`-Mutation ausgeführt (kein verwaister DB-Eintrag).
- Schlägt beim Löschen das R2-Delete fehl, wird der DB-Eintrag trotzdem entfernt und ein Warn-Toast gezeigt (verwaiste R2-Objekte sind akzeptabel, umgekehrt nicht).
- Serverseitige Admin-Checks in jeder Convex-Funktion; der UI-Guard allein reicht nicht.

## Verifikation

Keine bestehende Test-Suite für Convex-Funktionen — manueller Durchlauf: Datei hochladen → Badge-Count prüft → Download öffnet Datei → Löschen entfernt Eintrag und Objekt; Zugriff als Nicht-Admin verweigert.
