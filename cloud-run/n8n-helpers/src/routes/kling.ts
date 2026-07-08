import { Request, Response } from 'express';
import { encodeJwtToken } from 'src/helpers/encodeJwtToken';


export async function createJWT(req: Request, res: Response) {

    const password = process.env.KLING_JWT_PASSWORD;

    const reqPassword = req.body.password;

    const accessKey = process.env.KLING_JWT_ACCESS_KEY;
    const secretKey = process.env.KLING_JWT_SECRET_KEY;


    if (!accessKey || !secretKey) {
        return res.status(500).json({
            error: {
                message: 'Kling JWT access key or secret key not found',
            },
        });
    }

    if (password !== reqPassword) {
        return res.status(401).json({
            error: {
                message: 'Invalid password',
            },
        });
    }

    const authorization = encodeJwtToken(accessKey, secretKey);

    return res.status(200).json({
        authorization
    });


}
