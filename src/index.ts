
import express from 'express';
import subjectRouter from './routes/subjects.js';
import cors from 'cors';
import 'dotenv/config';
import securityMiddleware from './middleware/security.js';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './lib/auth.js';


const app = express();
const PORT  = 8000;
if (!process.env.FRONTEND_URL) console.warn('WARN: FRONTEND_URL is not set. CORS will not be configured correctly.');
app.use(cors({
    origin: process.env.FRONTEND_URL,
    credentials:true,
    methods:['GET', 'POST', 'PUT', 'DELETE'],
}))

// Health check - must be before security middleware so Railway's health checker is never blocked
app.get('/', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

app.all('/api/auth/*splat', toNodeHandler(auth))

app.use(express.json());
app.use('/api', securityMiddleware)  // Only protect /api routes, not health check

app.use('/api/subjects', subjectRouter);


app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server is running on port http://localhost:${PORT}`);
});
