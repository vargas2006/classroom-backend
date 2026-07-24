declare global {
    namespace Express {
        interface Request {
            user?: {
                role?: "admin" | "teacher" | "strudent";
            }
        }
    }
}

export {};