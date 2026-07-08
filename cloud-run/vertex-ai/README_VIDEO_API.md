# Vertex AI Video Generation API Wrapper

Dieser Service wrappt die Google Vertex AI Veo Video Generation API und bietet eine einfache REST-Schnittstelle.

## Endpoints

### 1. Video generieren (POST /videos/generate)

Startet eine Video-Generierung. Da die Generierung asynchron läuft, gibt dieser Endpoint einen `operationName` zurück, mit dem der Status abgefragt werden kann.

#### Request Body

```json
{
  "prompt": "Eine schnelle Kamerafahrt durch eine geschäftige dystopische Stadt mit hellen Neonschildern",
  "negativePrompt": "Deckenbeleuchtung, helle Farben",
  "aspectRatio": "16:9",
  "durationSeconds": 8,
  "sampleCount": 1,
  "seed": 12345,
  "personGeneration": "allow_adult",
  "resolution": "720p",
  "compressionQuality": "optimized",
  "enhancePrompt": true,
  "generateAudio": true,
  "storageUri": "gs://my-bucket/videos/"
}
```

#### Parameter

| Parameter | Typ | Erforderlich | Standard | Beschreibung |
|-----------|-----|--------------|----------|--------------|
| `prompt` | string | ✅ Ja | - | Textbeschreibung des Videos (max. 5000 Zeichen) |
| `negativePrompt` | string | ❌ Nein | - | Was nicht generiert werden soll |
| `aspectRatio` | enum | ❌ Nein | `"16:9"` | `"16:9"` oder `"9:16"` |
| `durationSeconds` | number | ❌ Nein | `8` | Videolänge: 4, 6 oder 8 Sekunden |
| `sampleCount` | number | ❌ Nein | `1` | Anzahl Videos (1-4) |
| `seed` | number | ❌ Nein | - | Seed für deterministische Generierung (0-4294967295) |
| `personGeneration` | enum | ❌ Nein | - | `"dont_allow"`, `"allow_adult"`, `"allow_all"` |
| `resolution` | enum | ❌ Nein | - | `"720p"`, `"1080p"`, `"4k"` (nur Veo 3.1 Preview) |
| `compressionQuality` | enum | ❌ Nein | `"optimized"` | `"optimized"` oder `"lossless"` |
| `enhancePrompt` | boolean | ❌ Nein | - | Gemini zur Prompt-Optimierung nutzen (nur Veo 2) |
| `generateAudio` | boolean | ❌ Nein | - | Audio generieren (erforderlich für Veo 3) |
| `storageUri` | string | ❌ Nein | - | GCS Bucket URI für Ausgabe (z.B. `"gs://bucket/path/"`) |

#### Image-to-Video Parameter (optional)

```json
{
  "prompt": "Das Bild zum Leben erwecken",
  "image": {
    "bytesBase64Encoded": "base64-encoded-image-data",
    "mimeType": "image/jpeg"
  }
}
```

Oder mit GCS URI:

```json
{
  "prompt": "Das Bild zum Leben erwecken",
  "image": {
    "gcsUri": "gs://my-bucket/input-image.jpg",
    "mimeType": "image/jpeg"
  }
}
```

#### Response

```json
{
  "success": true,
  "operationName": "projects/123456/locations/europe-west3/operations/7890123456",
  "message": "Video generation started. Use the operation name to check status.",
  "metadata": {}
}
```

### 2. Status abfragen (GET /videos/status/*)

Prüft den Status einer Video-Generierung.

#### Request

```bash
GET /videos/status/projects/123456/locations/europe-west3/operations/7890123456
```

#### Response (In Bearbeitung)

```json
{
  "success": true,
  "name": "projects/123456/locations/europe-west3/operations/7890123456",
  "done": false,
  "metadata": {
    "progressPercent": 45
  }
}
```

#### Response (Fertig)

```json
{
  "success": true,
  "name": "projects/123456/locations/europe-west3/operations/7890123456",
  "done": true,
  "response": {
    "videos": [
      {
        "gcsUri": "gs://my-bucket/videos/generated-video-1.mp4",
        "mimeType": "video/mp4"
      }
    ],
    "raiMediaFilteredCount": 0
  }
}
```

Wenn `storageUri` nicht angegeben wurde, enthält die Response `bytesBase64Encoded` statt `gcsUri`:

```json
{
  "success": true,
  "name": "projects/123456/locations/europe-west3/operations/7890123456",
  "done": true,
  "response": {
    "videos": [
      {
        "bytesBase64Encoded": "base64-encoded-video-data",
        "mimeType": "video/mp4"
      }
    ]
  }
}
```

### 3. Status abfragen (POST /videos/status)

Alternative Methode zum Statusabruf via POST.

#### Request Body

```json
{
  "operationName": "projects/123456/locations/europe-west3/operations/7890123456"
}
```

#### Response

Gleiche Struktur wie GET-Methode.

## Beispiel-Workflow

### 1. Video generieren

```bash
curl -X POST https://your-service.run.app/videos/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "prompt": "Ein einsamer Cowboy reitet bei einem wunderschönen Sonnenuntergang auf seinem Pferd über eine offene Ebene",
    "durationSeconds": 8,
    "aspectRatio": "16:9",
    "resolution": "1080p",
    "generateAudio": true
  }'
```

Response:
```json
{
  "success": true,
  "operationName": "projects/123456/locations/europe-west3/operations/7890123456",
  "message": "Video generation started. Use the operation name to check status."
}
```

### 2. Status prüfen (Polling)

```bash
curl -X GET "https://your-service.run.app/videos/status/projects/123456/locations/europe-west3/operations/7890123456" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3. Video herunterladen

Wenn `done: true` und Videos vorhanden sind:
- Bei `gcsUri`: Video vom GCS Bucket herunterladen
- Bei `bytesBase64Encoded`: Base64-String dekodieren und als MP4 speichern

## Umgebungsvariablen

```bash
GCP_PROJECT_ID=your-project-id
GCP_LOCATION=europe-west3
VERTEX_AI_VIDEO_MODEL=veo-3.1-generate-001  # Optional, Standard: veo-3.1-generate-001
```

## Verfügbare Modelle

- `veo-2.0-generate-001` (Veo 2)
- `veo-3.0-generate-001` (Veo 3)
- `veo-3.0-fast-generate-001` (Veo 3 Fast)
- `veo-3.1-generate-001` (Veo 3.1) ⭐ Standard
- `veo-3.1-fast-generate-001` (Veo 3.1 Fast)
- `veo-3.1-generate-preview` (Preview)
- `veo-3.1-fast-generate-preview` (Preview)

## Fehlerbehandlung

### Validation Error (400)

```json
{
  "error": "Validation Error",
  "message": "Invalid request body",
  "details": [
    {
      "path": ["prompt"],
      "message": "Prompt is required"
    }
  ]
}
```

### Server Error (500)

```json
{
  "error": "Internal Server Error",
  "message": "Video generation failed"
}
```

## Tipps

1. **Polling-Intervall**: Prüfe den Status alle 5-10 Sekunden
2. **Timeouts**: Video-Generierung kann 30-120 Sekunden dauern
3. **Storage**: Nutze `storageUri` für große Videos, um Base64-Overhead zu vermeiden
4. **Kosten**: Jede Generierung kostet Geld - siehe [Vertex AI Preise](https://cloud.google.com/vertex-ai/pricing)
5. **Rate Limits**: Beachte die API-Limits von Google Cloud

## Dokumentation

Offizielle Vertex AI Veo Dokumentation:
https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/veo-video-generation
