# Gemini API Test Requests

## 1. Einfacher Text-Request

```bash
curl -X POST http://localhost:8080/gemini/generate \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [
      {
        "role": "user",
        "parts": [
          {
            "text": "Erkläre mir, wie KI funktioniert."
          }
        ]
      }
    ]
  }'
```

## 2. Mit Generation Config

```bash
curl -X POST http://localhost:8080/gemini/generate \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-2.5-flash",
    "contents": [
      {
        "role": "user",
        "parts": [
          {
            "text": "Schreibe eine kurze Zusammenfassung über Machine Learning."
          }
        ]
      }
    ],
    "generationConfig": {
      "temperature": 0.7,
      "topP": 0.9,
      "topK": 40,
      "maxOutputTokens": 500
    }
  }'
```

## 3. Mit System Instruction

```bash
curl -X POST http://localhost:8080/gemini/generate \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [
      {
        "role": "user",
        "parts": [
          {
            "text": "Was ist TypeScript?"
          }
        ]
      }
    ],
    "systemInstruction": {
      "parts": [
        {
          "text": "Du bist ein hilfreicher Programmier-Assistent. Antworte immer auf Deutsch und erkläre technische Konzepte einfach und verständlich."
        }
      ]
    }
  }'
```

## 4. Multimodaler Request (mit Bild)

```bash
curl -X POST http://localhost:8080/gemini/generate \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [
      {
        "role": "user",
        "parts": [
          {
            "text": "Was zeigt dieses Bild?"
          },
          {
            "fileData": {
              "mimeType": "image/jpeg",
              "fileUri": "gs://cloud-samples-data/generative-ai/image/scones.jpg"
            }
          }
        ]
      }
    ]
  }'
```

## 5. Mit Base64-encoded Bild (inline)

```bash
curl -X POST http://localhost:8080/gemini/generate \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [
      {
        "role": "user",
        "parts": [
          {
            "text": "Beschreibe dieses Bild."
          },
          {
            "inlineData": {
              "mimeType": "image/png",
              "data": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
            }
          }
        ]
      }
    ]
  }'
```

## 6. Konversation (Chat mit History)

```bash
curl -X POST http://localhost:8080/gemini/generate \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [
      {
        "role": "user",
        "parts": [
          {
            "text": "Hallo, ich bin neu bei TypeScript."
          }
        ]
      },
      {
        "role": "model",
        "parts": [
          {
            "text": "Hallo! Schön, dass du TypeScript lernst. Wie kann ich dir helfen?"
          }
        ]
      },
      {
        "role": "user",
        "parts": [
          {
            "text": "Was ist der Unterschied zu JavaScript?"
          }
        ]
      }
    ]
  }'
```

## 7. Streaming Request

```bash
curl -X POST http://localhost:8080/gemini/generate \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [
      {
        "role": "user",
        "parts": [
          {
            "text": "Erzähle mir eine kurze Geschichte über einen Programmierer."
          }
        ]
      }
    ],
    "stream": true,
    "generationConfig": {
      "maxOutputTokens": 1000
    }
  }'
```

## 8. Mit Safety Settings

```bash
curl -X POST http://localhost:8080/gemini/generate \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [
      {
        "role": "user",
        "parts": [
          {
            "text": "Erkläre mir etwas über künstliche Intelligenz."
          }
        ]
      }
    ],
    "safetySettings": [
      {
        "category": "HARM_CATEGORY_HARASSMENT",
        "threshold": "BLOCK_MEDIUM_AND_ABOVE"
      },
      {
        "category": "HARM_CATEGORY_HATE_SPEECH",
        "threshold": "BLOCK_MEDIUM_AND_ABOVE"
      }
    ]
  }'
```

## 9. Minimaler Request (nur Text, alle Defaults)

```bash
curl -X POST http://localhost:8080/gemini/generate \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [
      {
        "parts": [
          {
            "text": "Hello, world!"
          }
        ]
      }
    ]
  }'
```

## JavaScript/TypeScript Beispiel

```typescript
const response = await fetch('http://localhost:8080/gemini/generate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: 'Was ist die Hauptstadt von Deutschland?'
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 256
    }
  })
});

const data = await response.json();
console.log(data);
```

## Python Beispiel

```python
import requests

url = "http://localhost:8080/gemini/generate"
payload = {
    "contents": [
        {
            "role": "user",
            "parts": [
                {
                    "text": "Erkläre mir Quantum Computing in einfachen Worten."
                }
            ]
        }
    ],
    "generationConfig": {
        "temperature": 0.8,
        "maxOutputTokens": 500
    }
}

response = requests.post(url, json=payload)
print(response.json())
```

## Erwartete Response (Non-Streaming)

```json
{
  "success": true,
  "candidates": [
    {
      "content": {
        "parts": [
          {
            "text": "Die Antwort des Modells..."
          }
        ],
        "role": "model"
      },
      "finishReason": "STOP",
      "safetyRatings": [...],
      "tokenCount": 123
    }
  ],
  "usageMetadata": {
    "promptTokenCount": 10,
    "candidatesTokenCount": 123,
    "totalTokenCount": 133
  }
}
```

## Erwartete Response (Streaming)

Server-Sent Events Format:
```
data: {"candidates": [{"content": {"parts": [{"text": "Die"}]}}]}

data: {"candidates": [{"content": {"parts": [{"text": " Antwort"}]}}]}

data: {"candidates": [{"content": {"parts": [{"text": " des"}]}}]}

...

data: [DONE]
```
