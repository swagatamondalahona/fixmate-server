
import { getDB } from "../config/db.js";

// Customer: Get My Payment History
export const getMyPayments = async (req, res) => {
    try {
        const db = getDB();

        const payments = await db
            .collection("payments")
            .find({
                customerId: req.user.id,
                paymentStatus: "paid",
            })
            .sort({ paidAt: -1 })
            .toArray();

        return res.status(200).json({
            success: true,
            message: "Payment history fetched successfully",
            payments,
        });
    } catch (error) {
        console.error("Get My Payments Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch payment history",
        });
    }
};
