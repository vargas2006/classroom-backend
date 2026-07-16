import express from 'express';
const app = express();
const Route = express.Router();
const PORT = 8000;

app.use(express.json())

app.get("/", (req, res) => {
    res.send("Hello Welcome to the Classroom API");
});

app.use("/api/v1/subjects", Route);

app.listen(PORT, () => {
    console.log(`Server started on port http://localhost:${PORT}`);
});