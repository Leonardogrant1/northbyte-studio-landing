# Vertex AI Service - API Wrapper

Dieser Cloud Run Service wrappt die Google Vertex AI APIs für Bild- und Videogenerierung und bietet einfache REST-Endpunkte.

## 🎯 Features

### 📸 Bildgenerierung (Imagen)
- ✅ Text-to-Image Generierung
- ✅ Bildbearbeitung mit Masken (Inpainting, Outpainting, Background Swap)
- ✅ Mehrsprachige Prompts
- ✅ Verschiedene Seitenverhältnisse und Auflösungen
- ✅ Sicherheitsfilter und Wasserzeichen

### 🎬 Videogenerierung (Veo)
- ✅ Text-to-Video Generierung
- ✅ Image-to-Video Animation
- ✅ Long-Running Operations mit Status-Polling
- ✅ Verschiedene Auflösungen (720p, 1080p, 4k)
- ✅ Audio-Generierung

## 📚 API Dokumentation

### Bilder

**Detaillierte Dokumentation:** [README_IMAGE_API.md](./README_IMAGE_API.md)

#### POST /images/generate
Generiert Bilder aus Textbeschreibungen.

```bash
curl -X POST https://your-service.run.app/images/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "prompt": "Ein fotorealistisches Bild eines Sonnenuntergangs",
    "numberOfImages": 4,
    "aspectRatio": "16:9",
    "sampleImageSize": "2K"
  }'
```

#### POST /images/edit
Bearbeitet Bilder mit Masken-basierter Bearbeitung.

```bash
curl -X POST https://your-service.run.app/images/edit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "prompt": "Ein roter Sportwagen",
    "referenceImages": [...],
    "editMode": "EDIT_MODE_INPAINT_INSERTION"
  }'
```

### Videos

**Detaillierte Dokumentation:** [README_VIDEO_API.md](./README_VIDEO_API.md)

#### POST /videos/generate
Startet eine Video-Generierung (asynchron).

```bash
curl -X POST https://your-service.run.app/videos/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "prompt": "Ein Cowboy reitet bei Sonnenuntergang",
    "durationSeconds": 8,
    "aspectRatio": "16:9",
    "resolution": "1080p",
    "generateAudio": true
  }'
```

**Response:**
```json
{
  "success": true,
  "operationName": "projects/.../operations/...",
  "message": "Video generation started. Use the operation name to check status."
}
```

#### GET /videos/status/*
Prüft den Status einer Video-Generierung.

```bash
curl -X GET "https://your-service.run.app/videos/status/projects/.../operations/..." \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response (fertig):**
```json
{
  "success": true,
  "done": true,
  "response": {
    "videos": [
      {
        "gcsUri": "gs://bucket/video.mp4",
        "mimeType": "video/mp4"
      }
    ]
  }
}
```

## 🚀 Deployment

### Umgebungsvariablen

```bash
# Required
SERVICE_ACCOUNT_B64=<base64-encoded-service-account-key>
GCP_LOCATION=us-central1

# Optional
PORT=8080
```

#### SERVICE_ACCOUNT_B64 generieren

Der Service Account Key muss als Base64-String übergeben werden:

```bash
# Service Account Key als Base64 encodieren
jq -c . your-service-account-key.json | base64 | tr -d '\n'

# Oder direkt in .env speichern
echo "SERVICE_ACCOUNT_B64=$(jq -c . your-service-account-key.json | base64 | tr -d '\n')" >> .env
```

**Wichtig:** Der Service Account benötigt folgende Berechtigungen:
- `Vertex AI User` oder `Vertex AI Administrator`
- Zugriff auf die Vertex AI APIs (Imagen, Veo)

### Cloud Run Deployment

```bash
# Build und Deploy
npm run deploy

# Oder manuell
docker build -t gcr.io/PROJECT_ID/vertex-ai .
docker push gcr.io/PROJECT_ID/vertex-ai
gcloud run deploy vertex-ai \
  --image gcr.io/PROJECT_ID/vertex-ai \
  --region europe-west3 \
  --platform managed
```

### Lokal testen

```bash
# Dependencies installieren
npm install

# Development Server starten
npm run dev

# Type-Check
npm run type-check

# Build
npm run build
```

## 📊 API Übersicht

| Endpoint | Methode | Beschreibung | Sync/Async |
|----------|---------|--------------|------------|
| `/images/generate` | POST | Bilder generieren | Sync |
| `/images/edit` | POST | Bilder bearbeiten | Sync |
| `/videos/generate` | POST | Video-Generierung starten | Async |
| `/videos/status/*` | GET | Video-Status abfragen | Sync |
| `/videos/status` | POST | Video-Status abfragen (alt.) | Sync |
| `/health` | GET | Health Check | Sync |

## 🔒 Authentifizierung

Der Service nutzt Google Cloud Service Accounts für die Authentifizierung mit Vertex AI. In Cloud Run wird automatisch der Metadata Server verwendet.

Für externe Requests zum Service:
- Cloud Run IAM-Authentifizierung
- Oder: API Gateway mit API Keys

## 💰 Kosten

Die Nutzung verursacht Kosten bei Google Cloud:

- **Bildgenerierung**: ~$0.02 - $0.08 pro Bild (je nach Auflösung)
- **Videogenerierung**: ~$0.10 - $0.50 pro Video (je nach Dauer/Auflösung)
- **Cloud Run**: Pay-per-use (CPU, Memory, Requests)

Siehe: [Vertex AI Preise](https://cloud.google.com/vertex-ai/pricing)

## 🛠️ Technologie-Stack

- **Runtime**: Node.js mit TypeScript
- **Framework**: Express.js
- **Validation**: Zod
- **HTTP Client**: Axios
- **Logging**: Pino
- **Deployment**: Cloud Run (Docker)

## 📝 Beispiel-Workflows

### Workflow 1: Produktbild mit neuem Hintergrund

```bash
# 1. Original-Produktbild und Maske vorbereiten
# 2. Hintergrund ersetzen
curl -X POST https://your-service.run.app/images/edit \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Luxuriöses Wohnzimmer mit modernem Design",
    "referenceImages": [
      {
        "referenceType": "REFERENCE_TYPE_RAW",
        "referenceId": 1,
        "referenceImage": {"bytesBase64Encoded": "..."}
      },
      {
        "referenceType": "REFERENCE_TYPE_MASK",
        "referenceId": 2,
        "referenceImage": {"bytesBase64Encoded": "..."},
        "maskImageConfig": {"maskMode": "MASK_MODE_BACKGROUND"}
      }
    ],
    "editMode": "EDIT_MODE_BGSWAP"
  }'
```

### Workflow 2: Marketing-Video erstellen

```bash
# 1. Video generieren
OPERATION=$(curl -X POST https://your-service.run.app/videos/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Produktpräsentation eines modernen Smartphones",
    "durationSeconds": 8,
    "aspectRatio": "9:16",
    "resolution": "1080p",
    "generateAudio": true,
    "storageUri": "gs://my-bucket/videos/"
  }' | jq -r '.operationName')

# 2. Status prüfen (alle 10 Sekunden)
while true; do
  STATUS=$(curl -X GET "https://your-service.run.app/videos/status/$OPERATION")
  DONE=$(echo $STATUS | jq -r '.done')
  if [ "$DONE" = "true" ]; then
    echo "Video fertig!"
    echo $STATUS | jq '.response.videos'
    break
  fi
  sleep 10
done
```

## 🐛 Fehlerbehandlung

Alle Endpoints geben strukturierte Fehler zurück:

```json
{
  "error": "Validation Error",
  "message": "Invalid request body",
  "details": [...]
}
```

HTTP Status Codes:
- `200` - Erfolg
- `400` - Validierungsfehler
- `401` - Authentifizierungsfehler
- `500` - Serverfehler

## 📖 Weitere Ressourcen

- [Imagen API Dokumentation](https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/imagen-api)
- [Veo API Dokumentation](https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/veo-video-generation)
- [Vertex AI Modelle](https://cloud.google.com/vertex-ai/generative-ai/docs/models)
- [Best Practices](https://cloud.google.com/vertex-ai/generative-ai/docs/image/img-gen-prompt-guide)

## 📄 Lizenz

Dieses Projekt ist Teil der NorthByte Studio Services.
