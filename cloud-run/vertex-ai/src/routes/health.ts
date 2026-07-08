import { Router, Request, Response } from 'express';

const router: ReturnType<typeof Router> = Router();

router.get('/', (req: Request, res: Response) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'vertex-ai',
        version: '1.0.0',
    });
});

export { router as healthRouter };
