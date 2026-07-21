import express from 'express';
import subjectRouter from './routes/subjects';
import cors from 'cors';

const app = express();
const PORT  = 8000;

app.use(cors({
    origin: process.env.FRONTEND_URL,
    credentials:true,
    methods:['GET', 'POST', 'PUT', 'DELETE'],
}))

app.use(express.json());

app.use('/api/subjects', subjectRouter);

app.get('/', (req, res) => {
    res.send('Hello World!');
});

app.listen(PORT, () => {
    console.log(`Server is running on port http://localhost:${PORT}`);
});
