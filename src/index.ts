import AgentAPI from "apminsight";
AgentAPI.config

import express from 'express';
import subjectRouter from './routes/subjects.js';
import cors from 'cors';
import 'dotenv/config';
import securityMiddleware from './middleware/security.js';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './lib/auth';


const app = express();
const PORT  = 8000;
if (!process.env.FRONTEND_URL) throw new Error('FRONTEND_URL is not set in .env file');
app.use(cors({
    origin: process.env.FRONTEND_URL,
    credentials:true,
    methods:['GET', 'POST', 'PUT', 'DELETE'],
}))

app.all('/api/auth/*splat', toNodeHandler(auth))

app.use(express.json());
app.use(securityMiddleware)

app.use('/api/subjects', subjectRouter);

app.get('/', (req, res) => {
    res.send('Hello World!');
});


app.listen(PORT, () => {
    console.log(`Server is running on port http://localhost:${PORT}`);
});
