import "dotenv/config";
import express, { Request, Response } from 'express';
import pino from 'pino';
import * as os from 'os';
import { mergeVideosHandler } from './routes/merge';
import { renderCaptionHandler } from './routes/caption';
import { storeVideoHandler, uploadMiddleware } from './routes/store';
import { adjustSubtitleHandler } from './routes/subtitle';
import { overlayImageHandler } from './routes/overlay';
import { createSlidePostHandler } from './routes/slidePost';
import { authMiddleware } from './middleware/auth';
import cors from 'cors';
import { createJWT } from "./routes/kling";

const logger = pino();

const app = express();
const port = +(process.env.PORT || 8080);

app.set('trust proxy', 1);

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cors({
  origin: '*',
}));
app.use(authMiddleware);

// Health check endpoint
app.get('/health', (_, res: Response) => {
  res.status(200).send('OK');
});

// Video merger endpoint
app.post('/merge-videos', mergeVideosHandler);

// Render caption endpoint
app.post('/render-caption', renderCaptionHandler);

// Store video from GCS to R2 endpoint (supports both file upload and GCS URI)
app.post('/videos/store', uploadMiddleware, storeVideoHandler);

// Adjust subtitle endpoint
app.post('/subtitles/adjust', adjustSubtitleHandler);

// Overlay image on video endpoint
app.post('/videos/overlay-image', overlayImageHandler);

app.post('/kling/create-jwt', createJWT);

// Create, upload and schedule a TikTok slide post
app.post('/slide-posts/create', createSlidePostHandler);

// Error handling middleware
app.use((err: any, req: Request, res: Response, next: express.NextFunction) => {
  logger.error(err.stack);

  const statusCode = err.status || 500;
  const errorMessage = statusCode >= 500
    ? 'Internal Server Error'
    : err.message || 'Bad Request';

  res.status(statusCode).json({
    error: {
      message: errorMessage,
    },
  });
});

// Graceful shutdown
const server = app.listen(port, async () => {
  const interfaces = os.networkInterfaces();
  const targetInterface = 'en0';
  let ipAddress = '';

  if (interfaces[targetInterface]) {
    for (const iface of interfaces[targetInterface]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ipAddress = iface.address;
        break;
      }
    }
  }

  if (!ipAddress) {
    logger.warn(`No valid IP address found for interface '${targetInterface}'.`);
  } else {
    logger.info(`Network: http://${ipAddress}:${port}`);
  }

  logger.info(`Server is running on port ${port}`);
});

process.on('SIGINT', async () => {
  logger.info('Shutting down server...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});
