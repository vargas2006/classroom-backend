import 'dotenv/config';  // MUST be first — loads .env before any other module reads process.env
import crypto from 'node:crypto';

// Polyfill globalThis.crypto for Better Auth in production environments where Web Crypto API is not in global scope
if (typeof globalThis.crypto === 'undefined') {
    // @ts-ignore
    globalThis.crypto = crypto.webcrypto || crypto;
}

import express from 'express';

import subjectRouter from './routes/subjects.js';
import userRouter from './routes/users.js';
import cors from 'cors';
import securityMiddleware from './middleware/security.js';
import sessionMiddleware from './middleware/session.js';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './lib/auth.js';
import classRouter from './routes/classes.js';
import departmentRouter from './routes/departments.js';
import statsRouter from './routes/stats.js';


const app = express();
const PORT  = 8000;
const frontendUrl = process.env.FRONTEND_URL?.replace(/\/$/, '');
const backendUrl = (process.env.BETTER_AUTH_URL || process.env.BACKEND_URL)?.replace(/\/$/, '');

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        const normalized = origin.replace(/\/$/, '');
        if (!frontendUrl || normalized === frontendUrl || normalized === backendUrl || process.env.NODE_ENV !== 'production') {
            return callback(null, true);
        }
        return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));

// Health check - must be before security middleware so Railway's health checker is never blocked
app.get('/', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

// Log env status at startup
console.log('[startup] BETTER_AUTH_SECRET set:', !!process.env.BETTER_AUTH_SECRET);
console.log('[startup] BETTER_AUTH_URL:', process.env.BETTER_AUTH_URL ?? process.env.BACKEND_URL);

// Auth route — catch + log any unhandled errors
const authHandler = toNodeHandler(auth);
app.all('/api/auth/*splat', async (req, res) => {
    try {
        await authHandler(req, res);
    } catch (e: any) {
        console.error('[auth handler error]', e?.message ?? e);
        if (!res.headersSent) {
            res.status(500).json({ error: e?.message ?? 'Auth error' });
        }
    }
});


app.use(express.json());
app.use('/api', sessionMiddleware)    // Attach session/user before rate limiting
app.use('/api', securityMiddleware)  // Only protect /api routes, not health check

app.use('/api/subjects', subjectRouter);
app.use('/api/users', userRouter);
app.use('/api/classes', classRouter);
app.use('/api/departments', departmentRouter);
app.use('/api/stats', statsRouter);


app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server is running on port http://localhost:${PORT}`);
});
