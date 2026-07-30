import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db/index.js";
import * as schema from '../db/schema/auth.js';

const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
const backendUrl = (process.env.BETTER_AUTH_URL || process.env.BACKEND_URL || 'http://localhost:8000').replace(/\/$/, '');

export const auth = betterAuth({
    baseURL: backendUrl,
    secret: process.env.BETTER_AUTH_SECRET,
    trustedOrigins: [frontendUrl, backendUrl],
    database: drizzleAdapter(db, {
        provider: "pg", 
        schema,
    }),
    advanced: {
        defaultCookieAttributes: {
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
            secure: process.env.NODE_ENV === 'production',
        },
    },
    emailAndPassword: {
        enabled: true,
    },
    user: {
        additionalFields: {
            role: {
                type: "string",
                required: true,
                defaultValue: 'student',
                input: true,
            },
            imageCldPubId: {
                type: "string",
                required: false,
                input: true,
            }
        }
    }
});