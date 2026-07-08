import { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger.js';

const AUTHORIZATION_TOKEN = process.env.AUTHORIZATION_TOKEN;

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
    // Skip auth if no AUTHORIZATION_TOKEN is configured
    if (!AUTHORIZATION_TOKEN) {
        logger.warn('AUTHORIZATION_TOKEN not set - API is unprotected!');
        return next();
    }

    const authHeader = req.headers.authorization;

    if (!authHeader) {
        logger.warn({ path: req.path, ip: req.ip }, 'Missing authorization header');
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Missing authorization header. Use: Authorization: Bearer <token>',
        });
    }

    const [type, token] = authHeader.split(' ');

    if (type !== 'Bearer' || token !== AUTHORIZATION_TOKEN) {
        logger.warn({ path: req.path, ip: req.ip }, 'Invalid authorization token');
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Invalid authorization token',
        });
    }

    logger.debug({ path: req.path }, 'Request authorized');
    next();
}
