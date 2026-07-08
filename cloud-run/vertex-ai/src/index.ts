import "dotenv/config"
import express, { Request, Response } from 'express';
import { logger } from './lib/logger.js';
import { healthRouter } from './routes/health.js';
import { imagesRouter } from './routes/images.js';
import { videosRouter } from './routes/videos.js';
import { geminiRouter } from './routes/gemini.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';


const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(requestLogger);

// Routes
app.use('/health', healthRouter);
app.use('/images', imagesRouter);
app.use('/videos', videosRouter);
app.use('/gemini', geminiRouter);

// 404 handler
app.use((req: Request, res: Response) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.path} not found`,
    });
});

// Error handler (must be last)
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
    logger.info(`🚀 Vertex AI service listening on port ${PORT}`);
    logger.info(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`🌍 Region: ${process.env.GCP_LOCATION || 'not set'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM signal received: closing HTTP server');
    process.exit(0);
});

process.on('SIGINT', () => {
    logger.info('SIGINT signal received: closing HTTP server');
    process.exit(0);
});
