import { connectDB } from "./src/config/db.js";
import express from "express";
import serviceRoutes from "./src/routes/serviceRoutes.js";

const app = express();

const PORT = 5000;

app.use(express.json());

app.use("/api/services", serviceRoutes);

app.get("/", (req, res) => {
    res.send("FixMate Backend Server is Running!");
});

connectDB()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`FixMate Server running on port ${PORT}`);
        });
    })
    .catch((error) => {
        console.error("Database connection failed:", error);
    });