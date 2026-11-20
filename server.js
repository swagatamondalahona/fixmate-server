
import express from "express";

import { connectDB } from "./src/config/db.js";

import serviceRoutes from "./src/routes/serviceRoutes.js";
import adminRoutes from "./src/routes/adminRoutes.js";
import bookingRoutes from "./src/routes/bookingRoutes.js";
import paymentRoutes from "./src/routes/paymentRoutes.js";
import userRoutes from "./src/routes/userRoutes.js";

const app = express();
const PORT = process.env.PORT || 5000;

// Native Express CORS Middleware
const allowedOrigins = [
    "http://localhost:3000",
    "https://fixmate-gules-three.vercel.app",
    process.env.FRONTEND_URL,
].filter(Boolean);

app.use((req, res, next) => {
    console.log(
        "API REQUEST:",
        req.method,
        req.originalUrl,
        req.headers.origin
    );

    const origin = req.headers.origin;

    if (origin && allowedOrigins.includes(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
    }

    res.setHeader(
        "Access-Control-Allow-Methods",
        "GET, POST, PATCH, PUT, DELETE, OPTIONS"
    );

    res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization"
    );

    res.setHeader("Vary", "Origin");

    if (req.method === "OPTIONS") {
        return res.sendStatus(204);
    }

    next();
});

// Stripe Webhook Raw Body
// This MUST be before express.json().
app.use(
    "/api/payments/webhook",
    express.raw({ type: "application/json" })
);

// JSON Middleware
app.use(express.json());

// API Routes
app.use("/api/services", serviceRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/users", userRoutes);

// Backend Health Check
app.get("/", (req, res) => {
    res.status(200).send("FixMate Backend Server is Running!");
});

// Connect Database and Start Server
connectDB()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`FixMate Server running on port ${PORT}`);
        });
    })
    .catch((error) => {
        console.error("Database connection failed:", error);
        process.exit(1);
    });
