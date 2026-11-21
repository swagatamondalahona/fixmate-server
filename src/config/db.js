
import { MongoClient } from "mongodb";

// Load environment variables from backend .env file
try {
    process.loadEnvFile();
} catch (error) {
    if (error.code !== "ENOENT") {
        throw error;
    }
}

// Validate MongoDB connection string
const mongoURI = process.env.MONGODB_URI;

if (!mongoURI) {
    throw new Error(
        "MONGODB_URI is missing. Please check fixmate-server/.env"
    );
}

const client = new MongoClient(mongoURI);

let db;

export async function connectDB() {
    try {
        await client.connect();

        db = client.db(process.env.DB_NAME || "fixmateDB");

        console.log("MongoDB Connected Successfully!");

        return db;
    } catch (error) {
        console.error("MongoDB Connection Error:", error);
        throw error;
    }
}

export function getDB() {
    if (!db) {
        throw new Error("Database is not connected!");
    }

    return db;
}
