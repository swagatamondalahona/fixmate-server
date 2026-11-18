
import { getDB } from "../config/db.js";

export const getFeaturedServices = async (req, res) => {
    try {
        const db = getDB();

        const services = await db
            .collection("services")
            .find({
                approvalStatus: "approved",
                isAvailable: true,
            })
            .sort({ createdAt: -1 })
            .limit(6)
            .toArray();

        res.status(200).json({
            success: true,
            message: "Featured services fetched successfully",
            data: services,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch featured services",
        });
    }
};
