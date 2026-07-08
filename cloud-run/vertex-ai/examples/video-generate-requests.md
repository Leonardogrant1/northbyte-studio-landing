# Video Generation API - Request Examples

## 1. Einfacher Text-zu-Video Request

```bash
curl -X POST http://localhost:8080/videos/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Eine schnelle Kamerafahrt durch eine geschäftige dystopische Stadt mit hellen Neonschildern",
    "aspectRatio": "16:9",
    "durationSeconds": 8,
    "sampleCount": 1
  }'
```

## 2. Image-to-Video mit Base64

```bash
curl -X POST http://localhost:8080/videos/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Das Bild zum Leben erwecken mit sanfter Bewegung",
    "image": {
      "bytesBase64Encoded": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "mimeType": "image/jpeg"
    },
    "aspectRatio": "16:9",
    "durationSeconds": 8,
    "generateAudio": true
  }'
```

## 3. Image-to-Video mit GCS URI

```bash
curl -X POST http://localhost:8080/videos/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Eine dynamische Kamerafahrt durch die Szene",
    "image": {
      "gcsUri": "gs://my-bucket/images/input-image.jpg",
      "mimeType": "image/jpeg"
    },
    "aspectRatio": "16:9",
    "durationSeconds": 6,
    "resolution": "1080p",
    "storageUri": "gs://my-bucket/videos/"
  }'
```

## 4. Mit Reference Images (Base64)

```bash
curl -X POST http://localhost:8080/videos/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Ein Video basierend auf den Referenzbildern mit sanfter Bewegung",
    "referenceImages": [
      {
        "image": {
          "bytesBase64Encoded": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
          "mimeType": "image/jpeg"
        },
        "referenceType": "STYLE_REFERENCE"
      },
      {
        "image": {
          "bytesBase64Encoded": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
          "mimeType": "image/png"
        },
        "referenceType": "CONTENT_REFERENCE"
      }
    ],
    "aspectRatio": "16:9",
    "durationSeconds": 8,
    "generateAudio": true
  }'
```

## 5. Mit Reference Images (GCS URIs)

```bash
curl -X POST http://localhost:8080/videos/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Erstelle ein Video im Stil der Referenzbilder",
    "referenceImages": [
      {
        "image": {
          "gcsUri": "gs://my-bucket/references/style-reference.jpg",
          "mimeType": "image/jpeg"
        },
        "referenceType": "STYLE_REFERENCE"
      },
      {
        "image": {
          "gcsUri": "gs://my-bucket/references/content-reference.png",
          "mimeType": "image/png"
        },
        "referenceType": "CONTENT_REFERENCE"
      },
      {
        "image": {
          "gcsUri": "gs://my-bucket/references/color-reference.jpg",
          "mimeType": "image/jpeg"
        }
      }
    ],
    "aspectRatio": "16:9",
    "durationSeconds": 8,
    "resolution": "1080p",
    "generateAudio": true,
    "storageUri": "gs://my-bucket/videos/"
  }'
```

## 6. Mit Image + Reference Images + Last Frame

```bash
curl -X POST http://localhost:8080/videos/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Ein Video das mit dem Input-Bild beginnt und mit dem Last Frame endet",
    "image": {
      "bytesBase64Encoded": "base64-encoded-start-image",
      "mimeType": "image/jpeg"
    },
    "lastFrame": {
      "gcsUri": "gs://my-bucket/images/end-frame.jpg",
      "mimeType": "image/jpeg"
    },
    "referenceImages": [
      {
        "image": {
          "gcsUri": "gs://my-bucket/references/style.jpg",
          "mimeType": "image/jpeg"
        },
        "referenceType": "STYLE_REFERENCE"
      }
    ],
    "aspectRatio": "16:9",
    "durationSeconds": 8,
    "generateAudio": true
  }'
```

## 7. Vollständiger Request mit allen Optionen

```bash
curl -X POST http://localhost:8080/videos/generate \
  -H "Content-Type: application/json" \
  -d '{
    "model": "veo-3.1-generate-001",
    "prompt": "Eine epische Kamerafahrt durch eine futuristische Stadt bei Nacht",
    "negativePrompt": "verschwommen, niedrige Qualität, Artefakte",
    "aspectRatio": "16:9",
    "durationSeconds": 8,
    "sampleCount": 2,
    "seed": 12345,
    "personGeneration": "allow_adult",
    "resolution": "1080p",
    "compressionQuality": "optimized",
    "enhancePrompt": false,
    "generateAudio": true,
    "storageUri": "gs://my-bucket/videos/",
    "image": {
      "gcsUri": "gs://my-bucket/images/start-image.jpg",
      "mimeType": "image/jpeg"
    },
    "lastFrame": {
      "gcsUri": "gs://my-bucket/images/end-frame.jpg",
      "mimeType": "image/jpeg"
    },
    "referenceImages": [
      {
        "image": {
          "gcsUri": "gs://my-bucket/references/style-1.jpg",
          "mimeType": "image/jpeg"
        },
        "referenceType": "STYLE_REFERENCE"
      },
      {
        "image": {
          "gcsUri": "gs://my-bucket/references/style-2.jpg",
          "mimeType": "image/jpeg"
        },
        "referenceType": "CONTENT_REFERENCE"
      }
    ]
  }'
```

## 8. Portrait-Video (9:16) mit Reference Image

```bash
curl -X POST http://localhost:8080/videos/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Ein vertikales Video im Stil des Referenzbildes",
    "referenceImages": [
      {
        "image": {
          "bytesBase64Encoded": "base64-encoded-reference-image",
          "mimeType": "image/jpeg"
        }
      }
    ],
    "aspectRatio": "9:16",
    "durationSeconds": 6,
    "resolution": "1080p",
    "generateAudio": true
  }'
```

## 9. Kurzes Video (4 Sekunden) mit Reference Images

```bash
curl -X POST http://localhost:8080/videos/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Ein kurzes Video basierend auf den Referenzbildern",
    "referenceImages": [
      {
        "image": {
          "gcsUri": "gs://my-bucket/references/ref1.jpg",
          "mimeType": "image/jpeg"
        }
      },
      {
        "image": {
          "gcsUri": "gs://my-bucket/references/ref2.jpg",
          "mimeType": "image/jpeg"
        }
      },
      {
        "image": {
          "gcsUri": "gs://my-bucket/references/ref3.jpg",
          "mimeType": "image/jpeg"
        }
      }
    ],
    "durationSeconds": 4,
    "aspectRatio": "16:9"
  }'
```

## 10. Video-Verlängerung (Video Extension/Lengthening)

```bash
curl -X POST http://localhost:8080/videos/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Das Video verlängern mit einer sanften Fortsetzung der Bewegung",
    "video": {
      "gcsUri": "gs://my-bucket/videos/existing-video.mp4",
      "mimeType": "video/mp4"
    },
    "aspectRatio": "16:9",
    "durationSeconds": 8,
    "sampleCount": 1,
    "storageUri": "gs://my-bucket/videos/"
  }'
```

## JavaScript/TypeScript Beispiel

```typescript
const response = await fetch('http://localhost:8080/videos/generate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    prompt: 'Ein Video basierend auf den Referenzbildern',
    referenceImages: [
      {
        image: {
          bytesBase64Encoded: base64ImageString1,
          mimeType: 'image/jpeg',
        },
        referenceType: 'STYLE_REFERENCE',
      },
      {
        image: {
          bytesBase64Encoded: base64ImageString2,
          mimeType: 'image/png',
        },
      },
    ],
    aspectRatio: '16:9',
    durationSeconds: 8,
    generateAudio: true,
    storageUri: 'gs://my-bucket/videos/',
  }),
});

const data = await response.json();
console.log('Operation Name:', data.operationName);

// Status prüfen
const statusResponse = await fetch(
  `http://localhost:8080/videos/status/${data.operationName}`
);
const status = await statusResponse.json();
console.log('Status:', status);
```

## Python Beispiel

```python
import requests
import base64
import time

# Lade Referenzbilder
with open('reference1.jpg', 'rb') as f:
    ref1_base64 = base64.b64encode(f.read()).decode('utf-8')

with open('reference2.jpg', 'rb') as f:
    ref2_base64 = base64.b64encode(f.read()).decode('utf-8')

url = "http://localhost:8080/videos/generate"
payload = {
    "prompt": "Ein Video im Stil der Referenzbilder",
    "referenceImages": [
        {
            "image": {
                "bytesBase64Encoded": ref1_base64,
                "mimeType": "image/jpeg"
            },
            "referenceType": "STYLE_REFERENCE"
        },
        {
            "image": {
                "bytesBase64Encoded": ref2_base64,
                "mimeType": "image/jpeg"
            }
        }
    ],
    "aspectRatio": "16:9",
    "durationSeconds": 8,
    "generateAudio": True,
    "storageUri": "gs://my-bucket/videos/"
}

response = requests.post(url, json=payload)
data = response.json()
operation_name = data['operationName']

# Status prüfen (Polling)
while True:
    status_response = requests.get(
        f"http://localhost:8080/videos/status/{operation_name}"
    )
    status = status_response.json()
    
    if status.get('done'):
        print("Video fertig!")
        print(status.get('response', {}).get('videos', []))
        break
    
    print(f"Progress: {status.get('metadata', {}).get('progressPercent', 0)}%")
    time.sleep(5)
```

## Erwartete Response

```json
{
  "success": true,
  "operationName": "projects/123456/locations/europe-west3/operations/7890123456",
  "message": "Video generation started. Use the operation name to check status.",
  "metadata": {}
}
```

## Status Response (wenn fertig)

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

## Wichtige Hinweise

1. **Reference Images**: Maximal 3 Reference Images erlaubt
2. **Image Inputs**: Du kannst `image`, `lastFrame` und `referenceImages` gleichzeitig verwenden
3. **Asynchron**: Die Generierung läuft asynchron - nutze den `operationName` zum Status-Check
4. **Polling**: Prüfe den Status alle 5-10 Sekunden
5. **Storage**: Nutze `storageUri` für große Videos, um Base64-Overhead zu vermeiden
6. **Reference Types**: `referenceType` ist optional, kann aber `STYLE_REFERENCE` oder `CONTENT_REFERENCE` sein
