import type { Request, Response, NextFunction } from "express"
import aj from "../config/arcjet.js";
import { ArcjetNodeRequest, slidingWindow } from "@arcjet/node";


const securityMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    if (process.env.NODE_ENV !== 'production') return next();

    try {
        const role: RateLimitRole = req.user?.role ?? "guest";
        let limit: number;
        let message: string;

        switch (role) {
            case "admin":
                limit = 500;
                message = 'Admin request limit exceeded (500 per minute)';
                break;
            case 'teacher':
            case 'student':
                limit = 200;
                message = 'User request limit exceeded (200 per minute). Please wait';
                break;
            default:
                limit = 100;
                message = 'Guest request limit exceeded (100 per minute). Please signup for higher limits';
        }

        const client = aj.withRule(
            slidingWindow({
                mode: 'LIVE',
                interval: '1m',
                max: limit,
            })
        )

        const forwardedFor = req.headers['x-forwarded-for'];
        const remoteAddress = (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor?.split(',')[0]?.trim())
            ?? req.socket.remoteAddress
            ?? req.ip
            ?? '127.0.0.1';

        const arcjetRequest: ArcjetNodeRequest = {
            headers: req.headers,
            method: req.method,
            url: req.originalUrl ?? req.url,
            socket: { remoteAddress },
        }

        const decision = await client.protect(arcjetRequest);
        if(decision.isDenied() && decision.reason.isBot()) {
            return res.status(403).json({ 
                error: 'Forbidden',
                message: 'Automated Request is not Allowed',
            })
        }

        if(decision.isDenied() && decision.reason.isShield()) {
            return res.status(403).json({ 
                error: 'Forbidden',
                message: 'Request Blocked by security policy',
            })
        }

        if(decision.isDenied() && decision.reason.isRateLimit()) {
            return res.status(429).json({ 
                error: 'Too many Request',
                message
            })
        }
        next();

    }catch(e){
        console.error('Arcjet middleware error:', e);
        res.status(500).json({error: 'Internal error', message: 'Something went wrong security middleware'})
    }

}

export default securityMiddleware