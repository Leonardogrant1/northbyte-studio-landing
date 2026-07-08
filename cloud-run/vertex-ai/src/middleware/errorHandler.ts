import { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger.js';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
    logger.error({
        error: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
    });

    const statusCode = err.statusCode || err.status || 500;
    const message = err.message || 'Internal Server Error';

    res.status(statusCode).json({
        error: err.name || 'Error',
        message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
}
