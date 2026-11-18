
import { MongoClient } from "mongodb";

const client = new MongoClient(process.env.MONGODB_URI);

let db;

export async function connectDB() {
    await client.connect();

    db = client.db(process.env.DB_NAME || "fixmateDB");

    console.log("MongoDB Connected Successfully!");

    return db;
}

export function getDB() {
    if (!db) {
        throw new Error("Database is not connected!");
    }

    return db;
}
