
import { getDB } from "../config/db.js";

// Admin: Get All Bookings
export const getAllAdminBookings = async (req, res) => {
    try {
        const db = getDB();

        const bookings = await db
            .collection("bookings")
            .find({})
            .sort({ createdAt: -1 })
            .toArray();

        return res.status(200).json({
            success: true,
            message: "All bookings fetched successfully",
            total: bookings.length,
            data: bookings,
        });
    } catch (error) {
        console.error("Get All Admin Bookings Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch bookings",
        });
    }
};
