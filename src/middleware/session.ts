import type { Request, Response, NextFunction } from "express";
import { auth } from "../lib/auth.js";
import { toNodeHandler } from "better-auth/node";

const sessionMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const session = await auth.api.getSession({
            headers: new Headers(req.headers as Record<string, string>),
        });

        if (session?.user) {
            req.user = {
                id: session.user.id,
                role: (session.user as any).role ?? "student",
                email: session.user.email,
                name: session.user.name,
            };
        }
    } catch {
        // No valid session — req.user stays undefined (treated as guest)
    }

    next();
};

export default sessionMiddleware;
