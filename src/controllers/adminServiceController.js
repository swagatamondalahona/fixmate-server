
import { getDB } from "../config/db.js";

// Admin: Get All Services
export const getAllAdminServices = async (req, res) => {
    try {
        const db = getDB();

        const services = await db
            .collection("services")
            .find({})
            .sort({ createdAt: -1 })
            .toArray();

        return res.status(200).json({
            success: true,
            message: "All services fetched successfully",
            total: services.length,
            data: services,
        });
    } catch (error) {
        console.error("Get all admin services error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch services",
        });
    }
};
