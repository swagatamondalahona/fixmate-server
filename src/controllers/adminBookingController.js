
import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";

const MIN_FINAL_AMOUNT_BDT = 100;

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

// Admin: Update Final Amount on Unpaid Completed Booking
export const updateAdminBookingAmount = async (req, res) => {
    try {
        const db = getDB();
        const { bookingId } = req.params;
        const amount = Number(req.body?.finalAmount);

        if (!ObjectId.isValid(bookingId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid booking ID",
            });
        }

        if (!Number.isFinite(amount) || amount < MIN_FINAL_AMOUNT_BDT) {
            return res.status(400).json({
                success: false,
                message: `Final amount must be at least ৳${MIN_FINAL_AMOUNT_BDT} (Stripe minimum online payment requirement)`,
            });
        }

        const result = await db.collection("bookings").updateOne(
            {
                _id: new ObjectId(bookingId),
                status: "completed",
                paymentStatus: { $nin: ["paid", "completed"] },
            },
            {
                $set: {
                    finalAmount: amount,
                    updatedAt: new Date(),
                },
            }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Unpaid completed booking not found",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Final amount updated successfully",
            data: { finalAmount: amount },
        });
    } catch (error) {
        console.error("Admin Update Booking Amount Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update final amount",
        });
    }
};
