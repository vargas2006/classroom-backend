type UserRoles = "admin" | "teacher" | "student";

type RateLimitRole = UserRoles | "guest";

declare namespace Express {
    interface Request {
        user?: {
            id: string;
            role: UserRoles;
            email: string;
            name: string;
        };
    }
}