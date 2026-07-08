# Authentifizierung

Der Vertex AI Service nutzt Google Cloud Service Account Keys für die Authentifizierung.

## Setup

### 1. Service Account erstellen

```bash
# Service Account erstellen
gcloud iam service-accounts create vertex-ai-service \
  --display-name="Vertex AI Service Account"

# Berechtigungen zuweisen
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:vertex-ai-service@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"

# Key erstellen und herunterladen
gcloud iam service-accounts keys create service-account-key.json \
  --iam-account=vertex-ai-service@YOUR_PROJECT_ID.iam.gserviceaccount.com
```

### 2. Key als Base64 encodieren

```bash
# Key als Base64 encodieren (ohne Zeilenumbrüche)
jq -c . service-account-key.json | base64 | tr -d '\n'

# Direkt in .env speichern
echo "SERVICE_ACCOUNT_B64=$(jq -c . service-account-key.json | base64 | tr -d '\n')" >> .env
```

### 3. Umgebungsvariable setzen

**.env Datei:**
```bash
SERVICE_ACCOUNT_B64=eyJ0eXBlIjoic2VydmljZV9hY2NvdW50IiwicHJvamVjdF9pZCI6InlvdXItcHJvamVjdCIsInByaXZhdGVfa2V5X2lkIjoiLi4uIiwicHJpdmF0ZV9rZXkiOiIuLi4ifQo=
GCP_LOCATION=us-central1
```

**Cloud Run:**
```bash
gcloud run deploy vertex-ai \
  --set-env-vars SERVICE_ACCOUNT_B64="$(cat service-account-key.json | jq -c . | base64 | tr -d '\n')" \
  --set-env-vars GCP_LOCATION=us-central1
```

## Benötigte Berechtigungen

Der Service Account benötigt folgende IAM-Rollen:

- **`roles/aiplatform.user`** - Für Vertex AI API-Zugriff
  - Oder `roles/aiplatform.admin` für erweiterte Rechte

### Spezifische Berechtigungen:

```
aiplatform.endpoints.predict
aiplatform.models.predict
aiplatform.operations.get
storage.objects.create  # Nur wenn storageUri verwendet wird
storage.objects.get     # Nur wenn storageUri verwendet wird
```

## Sicherheit

### Best Practices:

1. **Niemals den Key committen** - Füge `*.json` und `.env` zur `.gitignore` hinzu
2. **Minimale Berechtigungen** - Gib nur die nötigen Rechte
3. **Key-Rotation** - Rotiere Keys regelmäßig
4. **Secret Manager** - In Produktion: Nutze Google Secret Manager statt Env-Vars

### Secret Manager (Empfohlen für Produktion):

```bash
# Secret erstellen
gcloud secrets create vertex-ai-service-account \
  --data-file=service-account-key.json

# Cloud Run Zugriff geben
gcloud secrets add-iam-policy-binding vertex-ai-service-account \
  --member="serviceAccount:YOUR_CLOUD_RUN_SA@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# In Cloud Run mounten
gcloud run deploy vertex-ai \
  --update-secrets=SERVICE_ACCOUNT_B64=vertex-ai-service-account:latest
```

## Troubleshooting

### Fehler: "Failed to get access token"

**Ursache:** Service Account Key ist ungültig oder falsch encodiert

**Lösung:**
```bash
# Key validieren
echo $SERVICE_ACCOUNT_B64 | base64 -d | jq .

# Neu encodieren
jq -c . service-account-key.json | base64 | tr -d '\n'
```

### Fehler: "Permission denied"

**Ursache:** Service Account hat nicht die nötigen Berechtigungen

**Lösung:**
```bash
# Berechtigungen prüfen
gcloud projects get-iam-policy YOUR_PROJECT_ID \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:vertex-ai-service@YOUR_PROJECT_ID.iam.gserviceaccount.com"

# Rolle hinzufügen
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:vertex-ai-service@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"
```

### Fehler: "SERVICE_ACCOUNT_B64 environment variable is required"

**Ursache:** Umgebungsvariable nicht gesetzt

**Lösung:**
```bash
# Lokal: .env Datei erstellen
echo "SERVICE_ACCOUNT_B64=$(jq -c . service-account-key.json | base64 | tr -d '\n')" > .env

# Cloud Run: Env-Var setzen
gcloud run services update vertex-ai \
  --set-env-vars SERVICE_ACCOUNT_B64="$(cat service-account-key.json | jq -c . | base64 | tr -d '\n')"
```

## Lokale Entwicklung

Für lokale Entwicklung kannst du auch Application Default Credentials nutzen:

```bash
# ADC setzen
gcloud auth application-default login

# Oder Service Account Key direkt nutzen
export GOOGLE_APPLICATION_CREDENTIALS="./service-account-key.json"
```

**Hinweis:** Der Service nutzt primär `SERVICE_ACCOUNT_B64`. ADC ist nur ein Fallback.
