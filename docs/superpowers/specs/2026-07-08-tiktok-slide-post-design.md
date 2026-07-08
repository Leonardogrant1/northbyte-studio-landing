# TikTok 4-Slide-Post Generator — Design

**Datum:** 2026-07-08
**Datei:** `test-scripts/tiktok-slide-post.ts`

## Ziel

Ein Test-Script, das aus einem Thema einen fertigen 4-Slide-TikTok-Post generiert:
Texte via OpenAI (Structured Output), Bilder via OpenAI Responses API mit
`image_generation`-Tool, mit dem AI-Avatar "John" als wiedererkennbarer Person.

## Ablauf

1. **Input:** Thema als CLI-Argument:
   `npx tsx test-scripts/tiktok-slide-post.ts "5 Fehler beim Sprungkraft-Training"`
2. **Avatar laden:** `ConvexHttpClient` + `generic/queries:findByFilters`
   (Tabelle `ai_avatars`, `name contains "john"`) → `imageUrl` + `description`.
   Die generischen Queries brauchen keine Auth.
3. **Planung:** Ein Responses-API-Call mit JSON-Schema-Output liefert:
   - `caption` (TikTok-Caption inkl. Hashtags)
   - genau 4 Slides mit je `text` (Overlay-Text) und `sceneDescription` (Szene mit John)
   - Slide 1 = Hook, Slides 2–3 = Content, Slide 4 = Content + CTA für die App **jemp**
     (App für athletische Trainingspläne: Sprungkraft, Explosivität, Kraft, Mobilität)
   - Sprache: Deutsch (Johns Account ist deutsch)
4. **Bildgenerierung (verkettete Calls, Variante A):** Alle 4 Bilder in *einer*
   Responses-Konversation via `previous_response_id`. Erster Call bekommt Johns Foto
   als `input_image`-Referenz (`input_fidelity: "high"`), Folge-Calls referenzieren die
   vorherige Response → konsistenter Stil und konsistente Person über alle Slides.
   Format `1024x1536` (Portrait). Text wird direkt ins Bild gerendert.
5. **Output:** `test-scripts/output/<timestamp>/slide-1.png` … `slide-4.png`
   + `post.json` (Thema, Caption, Slide-Texte, Prompts, Avatar-Info).

## Technische Entscheidungen

- **Env:** `process.loadEnvFile()` für `.env` und `.env.local` (dotenv ist nicht
  installiert; Node 22 vorhanden). `OPENAI_API_KEY` liegt in `.env`,
  `NEXT_PUBLIC_CONVEX_URL` in beiden.
- **Modelle:** `gpt-5.5` als Konstante für Text- und Bild-Call (experimentell —
  falls die API den Namen ablehnt, Konstante anpassen).
- **Fehlerbehandlung:** Klarer Abbruch bei fehlendem API-Key/Convex-URL, Avatar nicht
  gefunden, Plan ≠ 4 Slides, oder Response ohne Bild. Kein Retry (Test-Script).

## Nicht im Scope

- Upload/Posting des fertigen Posts
- Retry-/Queue-Logik
- Einbindung in die Next.js-App
