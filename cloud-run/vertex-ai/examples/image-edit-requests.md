# Image Edit API - Request Examples

## 1. Inpainting - Objekt einfügen (mit Base64)

```bash
curl -X POST http://localhost:8080/images/edit \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Ein roter Sportwagen",
    "referenceImages": [
      {
        "referenceType": "REFERENCE_TYPE_RAW",
        "referenceId": 1,
        "referenceImage": {
          "bytesBase64Encoded": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        }
      },
      {
        "referenceType": "REFERENCE_TYPE_MASK",
        "referenceId": 2,
        "referenceImage": {
          "bytesBase64Encoded": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        },
        "maskImageConfig": {
          "maskMode": "MASK_MODE_USER_PROVIDED"
        }
      }
    ],
    "editMode": "EDIT_MODE_INPAINT_INSERTION",
    "numberOfImages": 1,
    "guidanceScale": 60
  }'
```

## 2. Inpainting - Objekt entfernen

```bash
curl -X POST http://localhost:8080/images/edit \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Entferne das Objekt im markierten Bereich",
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
    "editMode": "EDIT_MODE_INPAINT_REMOVAL",
    "negativePrompt": "verschwommen, Artefakte",
    "numberOfImages": 2,
    "guidanceScale": 75
  }'
```

## 3. Mit GCS URIs (statt Base64)

```bash
curl -X POST http://localhost:8080/images/edit \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Füge einen Sonnenuntergang im Hintergrund hinzu",
    "referenceImages": [
      {
        "referenceType": "REFERENCE_TYPE_RAW",
        "referenceId": 1,
        "referenceImage": {
          "gcsUri": "gs://my-bucket/images/original.jpg"
        }
      },
      {
        "referenceType": "REFERENCE_TYPE_MASK",
        "referenceId": 2,
        "referenceImage": {
          "gcsUri": "gs://my-bucket/images/mask.png"
        },
        "maskImageConfig": {
          "maskMode": "MASK_MODE_BACKGROUND"
        }
      }
    ],
    "editMode": "EDIT_MODE_INPAINT_INSERTION",
    "numberOfImages": 1,
    "storageUri": "gs://my-bucket/edited/",
    "outputMimeType": "image/png"
  }'
```

## 4. Background Swap

```bash
curl -X POST http://localhost:8080/images/edit \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Ein moderner Büro-Hintergrund",
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
          "maskMode": "MASK_MODE_BACKGROUND"
        }
      }
    ],
    "editMode": "EDIT_MODE_BGSWAP",
    "negativePrompt": "Personen, Gesichter",
    "numberOfImages": 1,
    "guidanceScale": 60,
    "baseSteps": 50
  }'
```

## 5. Outpainting (Bild erweitern)

```bash
curl -X POST http://localhost:8080/images/edit \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Erweitere das Bild nach rechts mit mehr Landschaft",
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
          "maskMode": "MASK_MODE_USER_PROVIDED",
          "maskDilation": 5
        }
      }
    ],
    "editMode": "EDIT_MODE_OUTPAINT",
    "numberOfImages": 1,
    "guidanceScale": 70
  }'
```

## 6. Mit allen Optionen

```bash
curl -X POST http://localhost:8080/images/edit \
  -H "Content-Type: application/json" \
  -d '{
    "model": "imagen-3.0-capability-001",
    "prompt": "Ein futuristisches Auto mit Neon-Beleuchtung",
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
          "maskMode": "MASK_MODE_USER_PROVIDED",
          "maskDilation": 3,
          "segmentationClasses": [1, 2]
        }
      }
    ],
    "editMode": "EDIT_MODE_INPAINT_INSERTION",
    "negativePrompt": "verschwommen, niedrige Qualität, Artefakte",
    "numberOfImages": 4,
    "guidanceScale": 75,
    "baseSteps": 50,
    "seed": 12345,
    "addWatermark": true,
    "safetyFilterLevel": "block_medium_and_above",
    "personGeneration": "allow_adult",
    "language": "de",
    "storageUri": "gs://my-bucket/edited/",
    "outputMimeType": "image/png",
    "compressionQuality": 90
  }'
```

## 7. Minimaler Request (nur erforderliche Felder)

```bash
curl -X POST http://localhost:8080/images/edit \
  -H "Content-Type: application/json" \
  -d '{
    "referenceImages": [
      {
        "referenceType": "REFERENCE_TYPE_RAW",
        "referenceId": 1,
        "referenceImage": {
          "bytesBase64Encoded": "base64-encoded-image"
        }
      }
    ]
  }'
```

## 8. Mit Semantic Mask (automatische Maskenerkennung)

```bash
curl -X POST http://localhost:8080/images/edit \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Mache den Himmel blauer",
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
          "maskMode": "MASK_MODE_SEMANTIC",
          "segmentationClasses": [3, 4]
        }
      }
    ],
    "editMode": "EDIT_MODE_INPAINT_INSERTION"
  }'
```

## JavaScript/TypeScript Beispiel

```typescript
const response = await fetch('http://localhost:8080/images/edit', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    prompt: 'Ein roter Sportwagen',
    referenceImages: [
      {
        referenceType: 'REFERENCE_TYPE_RAW',
        referenceId: 1,
        referenceImage: {
          bytesBase64Encoded: base64ImageString,
        },
      },
      {
        referenceType: 'REFERENCE_TYPE_MASK',
        referenceId: 2,
        referenceImage: {
          bytesBase64Encoded: base64MaskString,
        },
        maskImageConfig: {
          maskMode: 'MASK_MODE_USER_PROVIDED',
        },
      },
    ],
    editMode: 'EDIT_MODE_INPAINT_INSERTION',
    numberOfImages: 1,
    guidanceScale: 60,
  }),
});

const data = await response.json();
console.log(data.images);
```

## Python Beispiel

```python
import requests
import base64

# Lade Bilder und konvertiere zu Base64
with open('original.jpg', 'rb') as f:
    original_base64 = base64.b64encode(f.read()).decode('utf-8')

with open('mask.png', 'rb') as f:
    mask_base64 = base64.b64encode(f.read()).decode('utf-8')

url = "http://localhost:8080/images/edit"
payload = {
    "prompt": "Ein roter Sportwagen",
    "referenceImages": [
        {
            "referenceType": "REFERENCE_TYPE_RAW",
            "referenceId": 1,
            "referenceImage": {
                "bytesBase64Encoded": original_base64
            }
        },
        {
            "referenceType": "REFERENCE_TYPE_MASK",
            "referenceId": 2,
            "referenceImage": {
                "bytesBase64Encoded": mask_base64
            },
            "maskImageConfig": {
                "maskMode": "MASK_MODE_USER_PROVIDED"
            }
        }
    ],
    "editMode": "EDIT_MODE_INPAINT_INSERTION",
    "numberOfImages": 1,
    "guidanceScale": 60
}

response = requests.post(url, json=payload)
print(response.json())
```

## Erwartete Response

```json
{
  "success": true,
  "images": [
    {
      "bytesBase64Encoded": "base64-encoded-image-data",
      "gcsUri": "gs://bucket/path/image.png",
      "mimeType": "image/png",
      "safetyAttributes": {
        "categories": ["VIOLENCE"],
        "scores": [0.1]
      }
    }
  ],
  "metadata": {
    "model": "imagen-3.0-capability-001",
    "seed": 12345
  }
}
```

## Edit Modes

- `EDIT_MODE_INPAINT_INSERTION` - Fügt Objekte in markierte Bereiche ein
- `EDIT_MODE_INPAINT_REMOVAL` - Entfernt Objekte aus markierten Bereichen
- `EDIT_MODE_BGSWAP` - Tauscht den Hintergrund aus
- `EDIT_MODE_OUTPAINT` - Erweitert das Bild über die ursprünglichen Grenzen hinaus

## Mask Modes

- `MASK_MODE_USER_PROVIDED` - Benutzer stellt die Maske bereit
- `MASK_MODE_BACKGROUND` - Automatische Hintergrund-Erkennung
- `MASK_MODE_FOREGROUND` - Automatische Vordergrund-Erkennung
- `MASK_MODE_SEMANTIC` - Semantische Segmentierung mit Klassen
