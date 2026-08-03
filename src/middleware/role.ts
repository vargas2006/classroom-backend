import type { Request, Response, NextFunction } from "express";

export const requireRole = (...allowedRoles: Array<"admin" | "teacher" | "student">) => {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({ error: "Authentication required." });
        }
        if (!allowedRoles.includes(req.user.role as any)) {
            return res.status(403).json({ error: `Access denied. ${req.user.role} is not permitted to perform this action.` });
        }
        next();
    };
};
