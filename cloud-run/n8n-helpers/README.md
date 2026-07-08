# N8N Video Merger

Cloud Run service that merges multiple videos using ffmpeg and uploads the result to Cloudflare R2.

## Features

- Accepts an array of video URLs
- Downloads and merges videos using ffmpeg
- Uploads merged video to Cloudflare R2
- Returns download URL in response

## API Endpoint

### POST `/merge-videos`

Merges multiple videos into a single video file.

**Request Body:**
```json
{
  "video_urls": [
    "https://example.com/video1.mp4",
    "https://example.com/video2.mp4",
    "https://example.com/video3.mp4"
  ]
}
```

**Response (Success):**
```json
{
  "success": true,
  "download_url": "https://your-r2-domain.com/merged-videos/uuid.mp4"
}
```

**Response (Error):**
```json
{
  "error": {
    "message": "Error description"
  }
}
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Cloudflare R2 Configuration
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your_access_key_id
R2_SECRET_ACCESS_KEY=your_secret_access_key
R2_BUCKET_NAME=your_bucket_name
R2_PUBLIC_URL=https://your-public-domain.com

# Server Configuration
PORT=8080
```

## Development

```bash
# Install dependencies
pnpm install

# Run in development mode
pnpm dev

# Build
pnpm build

# Run production build
pnpm start
```

## Docker

```bash
# Build Docker image
docker build --build-arg PROJECT=n8n-helpers -t northbytestudio/n8n-helpers:latest .

# Run Docker container
pnpm docker:run
```

## Deployment

Deploy to Google Cloud Run:

```bash
pnpm deploy
```

## Technical Details

- **Video Processing**: Uses fluent-ffmpeg with concat demuxer
- **Storage**: Cloudflare R2 (S3-compatible)
- **Temporary Files**: Automatically cleaned up after processing
- **Memory**: 2Gi (configurable in package.json)
- **CPU**: 2 cores (configurable in package.json)
- **Timeout**: 3600s (1 hour)

## Notes

- Videos must be in compatible formats for ffmpeg concat
- All videos should have the same codec, resolution, and frame rate for best results
- The service uses `-c copy` to avoid re-encoding (faster processing)
- If videos have different formats, consider using re-encoding instead
