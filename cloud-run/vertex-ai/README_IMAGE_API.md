# Vertex AI Image Generation & Editing API Wrapper

Dieser Service wrappt die Google Vertex AI Imagen API und bietet REST-Schnittstellen für Bildgenerierung und Bildbearbeitung.

## Endpoints

### 1. Bilder generieren (POST /images/generate)

Generiert Bilder aus Textbeschreibungen.

#### Request Body

```json
{
  "prompt": "Ein fotorealistisches Bild eines Sonnenuntergangs über dem Meer",
  "negativePrompt": "verschwommen, niedrige Qualität",
  "numberOfImages": 4,
  "aspectRatio": "16:9",
  "guidanceScale": 60,
  "seed": 12345,
  "addWatermark": true,
  "safetyFilterLevel": "block_medium_and_above",
  "personGeneration": "allow_adult",
  "sampleImageSize": "2K",
  "language": "de",
  "enhancePrompt": true,
  "storageUri": "gs://my-bucket/images/",
  "outputMimeType": "image/jpeg",
  "compressionQuality": 90
}
```

#### Parameter

| Parameter | Typ | Erforderlich | Standard | Beschreibung |
|-----------|-----|--------------|----------|--------------|
| `prompt` | string | ✅ Ja | - | Textbeschreibung des Bildes (max. 5000 Zeichen) |
| `negativePrompt` | string | ❌ Nein | - | Was nicht im Bild sein soll |
| `numberOfImages` | number | ❌ Nein | `4` | Anzahl Bilder (1-8) |
| `aspectRatio` | enum | ❌ Nein | - | `"1:1"`, `"9:16"`, `"16:9"`, `"4:3"`, `"3:4"` |
| `guidanceScale` | number | ❌ Nein | - | Wie stark der Prompt befolgt wird (0-500) |
| `seed` | number | ❌ Nein | - | Seed für deterministische Generierung (0-4294967295) |
| `addWatermark` | boolean | ❌ Nein | `true` | Unsichtbares Wasserzeichen hinzufügen |
| `safetyFilterLevel` | enum | ❌ Nein | `"block_medium_and_above"` | Sicherheitsfilter-Level |
| `personGeneration` | enum | ❌ Nein | `"allow_adult"` | Personen-Generierung |
| `sampleImageSize` | enum | ❌ Nein | `"1K"` | `"1K"` oder `"2K"` |
| `language` | enum | ❌ Nein | `"en"` | Prompt-Sprache |
| `enhancePrompt` | boolean | ❌ Nein | - | LLM zur Prompt-Verbesserung nutzen |
| `storageUri` | string | ❌ Nein | - | GCS Bucket URI für Ausgabe |
| `outputMimeType` | enum | ❌ Nein | `"image/png"` | `"image/png"` oder `"image/jpeg"` |
| `compressionQuality` | number | ❌ Nein | `75` | JPEG-Kompression (0-100) |

#### Safety Filter Levels

- `"block_low_and_above"` - Stärkste Filterung
- `"block_medium_and_above"` - Moderate Filterung (Standard)
- `"block_only_high"` - Schwache Filterung
- `"block_none"` - Minimale Filterung (eingeschränkter Zugriff)

#### Person Generation

- `"dont_allow"` - Keine Personen/Gesichter
- `"allow_adult"` - Nur Erwachsene (Standard)
- `"allow_all"` - Alle Altersgruppen

#### Unterstützte Sprachen

`auto`, `en`, `zh`, `zh-CN`, `zh-TW`, `hi`, `ja`, `ko`, `pt`, `es`

#### Response

```json
{
  "success": true,
  "images": [
    {
      "bytesBase64Encoded": "base64-encoded-image-data",
      "mimeType": "image/png"
    },
    {
      "bytesBase64Encoded": "base64-encoded-image-data",
      "mimeType": "image/png"
    }
  ],
  "metadata": {}
}
```

Wenn `storageUri` angegeben wurde:

```json
{
  "success": true,
  "images": [
    {
      "gcsUri": "gs://my-bucket/images/generated-1.png",
      "mimeType": "image/png"
    }
  ]
}
```

### 2. Bilder bearbeiten (POST /images/edit)

Bearbeitet Bilder mit Masken-basierter Bearbeitung (Inpainting, Outpainting, Background Swap).

#### Request Body

```json
{
  "prompt": "Ein roter Sportwagen",
  "referenceImages": [
    {
      "referenceType": "REFERENCE_TYPE_RAW",
      "referenceId": 1,
      "referenceImage": {
        "bytesBase64Encoded": "base64-encoded-original-image"
      }
    },
    {
      "referenceType": "REFERENCE_TYPE_MASK",
      "referenceId": 2,
      "referenceImage": {
        "bytesBase64Encoded": "base64-encoded-mask-image"
      },
      "maskImageConfig": {
        "maskMode": "MASK_MODE_USER_PROVIDED"
      }
    }
  ],
  "editMode": "EDIT_MODE_INPAINT_INSERTION",
  "negativePrompt": "verschwommen",
  "numberOfImages": 1,
  "guidanceScale": 60,
  "baseSteps": 75,
  "seed": 12345,
  "addWatermark": true,
  "safetyFilterLevel": "block_medium_and_above",
  "personGeneration": "allow_adult",
  "language": "de",
  "storageUri": "gs://my-bucket/edited/",
  "outputMimeType": "image/png"
}
```

#### Parameter

| Parameter | Typ | Erforderlich | Standard | Beschreibung |
|-----------|-----|--------------|----------|--------------|
| `prompt` | string | ❌ Nein | - | Textbeschreibung für die Bearbeitung |
| `referenceImages` | array | ✅ Ja | - | 1-2 Referenzbilder (RAW + optional MASK) |
| `editMode` | enum | ❌ Nein | - | Bearbeitungsmodus |
| `negativePrompt` | string | ❌ Nein | - | Was vermieden werden soll |
| `numberOfImages` | number | ❌ Nein | `1` | Anzahl Varianten (1-8) |
| `guidanceScale` | number | ❌ Nein | 60/75 | Prompt-Stärke (0-500) |
| `baseSteps` | number | ❌ Nein | `75` | Sampling-Schritte (16-75) |
| `seed` | number | ❌ Nein | - | Seed (0-4294967295) |
| `addWatermark` | boolean | ❌ Nein | `true` | Wasserzeichen |
| `safetyFilterLevel` | enum | ❌ Nein | - | Sicherheitsfilter |
| `personGeneration` | enum | ❌ Nein | - | Personen-Generierung |
| `language` | enum | ❌ Nein | `"en"` | Prompt-Sprache |
| `storageUri` | string | ❌ Nein | - | GCS Bucket URI |
| `outputMimeType` | enum | ❌ Nein | `"image/png"` | Ausgabeformat |
| `compressionQuality` | number | ❌ Nein | `75` | JPEG-Kompression |

#### Reference Image Types

- `"REFERENCE_TYPE_RAW"` - Original-Bild
- `"REFERENCE_TYPE_MASK"` - Masken-Bild (welche Bereiche bearbeitet werden)
- `"REFERENCE_TYPE_STYLE"` - Stil-Referenz

#### Edit Modes

- `"EDIT_MODE_INPAINT_REMOVAL"` - Objekte entfernen und Hintergrund auffüllen
- `"EDIT_MODE_INPAINT_INSERTION"` - Objekte aus Prompt einfügen
- `"EDIT_MODE_BGSWAP"` - Hintergrund ersetzen, Objekt behalten
- `"EDIT_MODE_OUTPAINT"` - Bild erweitern (über Bildgrenzen hinaus)

#### Mask Modes

- `"MASK_MODE_USER_PROVIDED"` - Benutzerdefinierte Maske
- `"MASK_MODE_BACKGROUND"` - Automatische Hintergrund-Maske
- `"MASK_MODE_FOREGROUND"` - Automatische Vordergrund-Maske
- `"MASK_MODE_SEMANTIC"` - Semantische Segmentierung

#### Response

```json
{
  "success": true,
  "images": [
    {
      "bytesBase64Encoded": "base64-encoded-edited-image",
      "mimeType": "image/png"
    }
  ],
  "metadata": {}
}
```

## Beispiele

### Beispiel 1: Einfache Bildgenerierung

```bash
curl -X POST https://your-service.run.app/images/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "prompt": "Ein fotorealistisches Bild eines Sonnenuntergangs über dem Meer mit Palmen",
    "numberOfImages": 2,
    "aspectRatio": "16:9",
    "sampleImageSize": "2K"
  }'
```

### Beispiel 2: Hochwertige Bildgenerierung mit allen Optionen

```bash
curl -X POST https://your-service.run.app/images/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "prompt": "Ein modernes Wohnzimmer mit minimalistischem Design, natürliches Licht, Pflanzen",
    "negativePrompt": "unordentlich, dunkel, überladen",
    "numberOfImages": 4,
    "aspectRatio": "4:3",
    "guidanceScale": 100,
    "sampleImageSize": "2K",
    "enhancePrompt": true,
    "personGeneration": "dont_allow",
    "outputMimeType": "image/jpeg",
    "compressionQuality": 95
  }'
```

### Beispiel 3: Objekt entfernen (Inpainting Removal)

```bash
curl -X POST https://your-service.run.app/images/edit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "referenceImages": [
      {
        "referenceType": "REFERENCE_TYPE_RAW",
        "referenceId": 1,
        "referenceImage": {
          "bytesBase64Encoded": "BASE64_ORIGINAL_IMAGE"
        }
      },
      {
        "referenceType": "REFERENCE_TYPE_MASK",
        "referenceId": 2,
        "referenceImage": {
          "bytesBase64Encoded": "BASE64_MASK_IMAGE"
        },
        "maskImageConfig": {
          "maskMode": "MASK_MODE_USER_PROVIDED"
        }
      }
    ],
    "editMode": "EDIT_MODE_INPAINT_REMOVAL",
    "baseSteps": 30
  }'
```

### Beispiel 4: Objekt einfügen (Inpainting Insertion)

```bash
curl -X POST https://your-service.run.app/images/edit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "prompt": "Ein roter Sportwagen",
    "referenceImages": [
      {
        "referenceType": "REFERENCE_TYPE_RAW",
        "referenceId": 1,
        "referenceImage": {
          "gcsUri": "gs://my-bucket/original.jpg"
        }
      },
      {
        "referenceType": "REFERENCE_TYPE_MASK",
        "referenceId": 2,
        "referenceImage": {
          "gcsUri": "gs://my-bucket/mask.png"
        },
        "maskImageConfig": {
          "maskMode": "MASK_MODE_USER_PROVIDED"
        }
      }
    ],
    "editMode": "EDIT_MODE_INPAINT_INSERTION",
    "guidanceScale": 60,
    "numberOfImages": 2
  }'
```

### Beispiel 5: Hintergrund ersetzen (Background Swap)

```bash
curl -X POST https://your-service.run.app/images/edit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "prompt": "Strand bei Sonnenuntergang",
    "referenceImages": [
      {
        "referenceType": "REFERENCE_TYPE_RAW",
        "referenceId": 1,
        "referenceImage": {
          "bytesBase64Encoded": "BASE64_PRODUCT_IMAGE"
        }
      },
      {
        "referenceType": "REFERENCE_TYPE_MASK",
        "referenceId": 2,
        "referenceImage": {
          "bytesBase64Encoded": "BASE64_BACKGROUND_MASK"
        },
        "maskImageConfig": {
          "maskMode": "MASK_MODE_BACKGROUND"
        }
      }
    ],
    "editMode": "EDIT_MODE_BGSWAP",
    "guidanceScale": 75
  }'
```

## Umgebungsvariablen

```bash
GCP_PROJECT_ID=your-project-id
GCP_LOCATION=us-central1
VERTEX_AI_IMAGE_MODEL=imagegeneration@006  # Optional, für Generierung
VERTEX_AI_IMAGE_EDIT_MODEL=imagen-3.0-capability-001  # Optional, für Bearbeitung
```

## Verfügbare Modelle

### Bildgenerierung
- `imagegeneration@006` (Imagen 2) ⭐ Standard
- `imagegeneration@005` (Imagen 2)
- `imagegeneration@002` (Imagen 1)

### Bildbearbeitung
- `imagen-3.0-capability-001` (Imagen 3) ⭐ Standard

## Masken erstellen

Für die Bildbearbeitung benötigst du Masken:

### Weiße Bereiche = Bearbeiten
- Weiße Pixel (255, 255, 255) markieren Bereiche, die bearbeitet werden
- Schwarze Pixel (0, 0, 0) bleiben unverändert

### Beispiel: Maske in Python erstellen

```python
from PIL import Image, ImageDraw
import base64
from io import BytesIO

# Leere Maske erstellen (gleiche Größe wie Original)
mask = Image.new('RGB', (1024, 1024), color='black')
draw = ImageDraw.Draw(mask)

# Rechteck markieren (wird bearbeitet)
draw.rectangle([100, 100, 500, 500], fill='white')

# Als Base64 encodieren
buffer = BytesIO()
mask.save(buffer, format='PNG')
mask_base64 = base64.b64encode(buffer.getvalue()).decode()
```

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

### Safety Filter (Bild gefiltert)

```json
{
  "success": true,
  "images": [
    {
      "raiFilteredReason": "Sensitive content detected",
      "mimeType": "image/png"
    }
  ]
}
```

## Tipps

1. **Prompt-Qualität**: Detaillierte Prompts liefern bessere Ergebnisse
2. **Negative Prompts**: Nutze sie, um unerwünschte Elemente zu vermeiden
3. **Guidance Scale**: 
   - Niedrig (10-30): Mehr Kreativität
   - Mittel (40-80): Ausgewogen
   - Hoch (90-150): Sehr prompt-treu
4. **Seed**: Nutze denselben Seed für konsistente Ergebnisse
5. **Enhance Prompt**: Aktiviere dies für bessere Bildqualität
6. **Storage URI**: Nutze GCS für große Bilder, um Base64-Overhead zu vermeiden
7. **Masken**: Für beste Ergebnisse sollten Masken saubere Kanten haben
8. **Base Steps**: Niedrigere Werte (16-35) für schnellere Generierung bei kleinen Masken

## Kosten

- **Bildgenerierung**: Pro generiertes Bild
- **Bildbearbeitung**: Pro bearbeitetes Bild
- Siehe [Vertex AI Preise](https://cloud.google.com/vertex-ai/pricing)

## Dokumentation

Offizielle Vertex AI Imagen Dokumentation:
- Bildgenerierung: https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/imagen-api
- Bildbearbeitung: https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/imagen-api-edit
