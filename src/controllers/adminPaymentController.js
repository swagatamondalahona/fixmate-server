
import { getDB } from "../config/db.js";

// Admin: Get All Transactions
export const getAllAdminTransactions = async (req, res) => {
    try {
        const db = getDB();

        const payments = await db
            .collection("payments")
            .find({})
            .sort({ createdAt: -1 })
            .toArray();

        const transactions = await Promise.all(
            payments.map(async (payment) => {
                const booking = await db
                    .collection("bookings")
                    .findOne({ _id: payment.bookingId });

                return {
                    ...payment,
                    bookingId: payment.bookingId?.toString() || "",
                    serviceTitle:
                        payment.serviceTitle || booking?.serviceTitle || "N/A",
                    customerName:
                        payment.customerName || booking?.customerName || "",
                    customerEmail:
                        payment.customerEmail || booking?.customerEmail || "N/A",
                    technicianName:
                        payment.technicianName || booking?.technicianName || "",
                    technicianEmail:
                        payment.technicianEmail ||
                        booking?.technicianEmail ||
                        "N/A",
                    transactionId:
                        payment.transactionId ||
                        payment.stripePaymentIntent ||
                        payment.stripeSessionId ||
                        "N/A",
                    paymentStatus: payment.paymentStatus || payment.status || "paid",
                };
            })
        );

        return res.status(200).json({
            success: true,
            message: "All transactions fetched successfully",
            total: transactions.length,
            data: transactions,
        });
    } catch (error) {
        console.error("Get All Admin Transactions Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch transactions",
        });
    }
};
