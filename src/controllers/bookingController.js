
import { getDB } from "../config/db.js";
import { ObjectId } from "mongodb";

// Customer: Create Booking
export const createBooking = async (req, res) => {
    try {
        const db = getDB();

        const { serviceId, bookingDate, address, notes } = req.body;

        if (
            !serviceId ||
            !ObjectId.isValid(serviceId) ||
            !bookingDate ||
            !address?.trim()
        ) {
            return res.status(400).json({
                success: false,
                message: "Service, booking date and address are required",
            });
        }

        const service = await db.collection("services").findOne({
            _id: new ObjectId(serviceId),
            approvalStatus: "approved",
            isAvailable: true,
        });

        if (!service) {
            return res.status(404).json({
                success: false,
                message: "Service not found or unavailable",
            });
        }

        const booking = {
            serviceId: service._id,
            serviceTitle: service.title,
            serviceImage: service.image || "",
            technicianId: service.technicianId,
            technicianEmail: service.technicianEmail || "",

            customerId: req.user.id,
            customerEmail: req.user.email || "",

            bookingDate: new Date(bookingDate),
            address: address.trim(),
            notes: notes || "",

            basePrice: service.basePrice,
            finalAmount: null,

            status: "requested",
            paymentStatus: "unpaid",

            createdAt: new Date(),
            updatedAt: new Date(),
        };

        if (Number.isNaN(booking.bookingDate.getTime())) {
            return res.status(400).json({
                success: false,
                message: "Invalid booking date",
            });
        }

        const result = await db.collection("bookings").insertOne(booking);

        res.status(201).json({
            success: true,
            message: "Booking created successfully",
            data: {
                _id: result.insertedId,
                ...booking,
            },
        });
    } catch (error) {
        console.error("Create Booking Error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to create booking",
        });
    }
};

// Customer: Get Own Bookings
export const getMyBookings = async (req, res) => {
    try {
        const db = getDB();

        const bookings = await db
            .collection("bookings")
            .find({ customerId: req.user.id })
            .sort({ createdAt: -1 })
            .toArray();

        res.status(200).json({
            success: true,
            message: "Bookings fetched successfully",
            data: bookings,
        });
    } catch (error) {
        console.error("Get Customer Bookings Error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to fetch bookings",
        });
    }
};

// Technician: Get Assigned Bookings
export const getTechnicianBookings = async (req, res) => {
    try {
        const db = getDB();

        const bookings = await db
            .collection("bookings")
            .find({ technicianId: req.user.id })
            .sort({ createdAt: -1 })
            .toArray();

        res.status(200).json({
            success: true,
            message: "Technician bookings fetched successfully",
            data: bookings,
        });
    } catch (error) {
        console.error("Get Technician Bookings Error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to fetch technician bookings",
        });
    }
};

// Technician: Update Booking Status
export const updateBookingStatus = async (req, res) => {
    try {
        const db = getDB();

        const { bookingId } = req.params;
        const { status, finalAmount } = req.body;

        if (!ObjectId.isValid(bookingId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid booking ID",
            });
        }

        const booking = await db.collection("bookings").findOne({
            _id: new ObjectId(bookingId),
            technicianId: req.user.id,
        });

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found",
            });
        }

        const allowedTransitions = {
            requested: ["accepted", "rejected"],
            accepted: ["in-progress"],
            "in-progress": ["completed"],
        };

        if (!allowedTransitions[booking.status]?.includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid booking status transition",
            });
        }

        const updateData = {
            status,
            updatedAt: new Date(),
        };

        if (status === "completed") {
            const amount = Number(finalAmount);

            if (!Number.isFinite(amount) || amount <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "A final amount greater than zero is required",
                });
            }

            updateData.finalAmount = amount;
        }

        const result = await db.collection("bookings").updateOne(
            {
                _id: new ObjectId(bookingId),
                technicianId: req.user.id,
                status: booking.status,
            },
            {
                $set: updateData,
            }
        );

        if (result.modifiedCount === 0) {
            return res.status(409).json({
                success: false,
                message: "Booking status could not be updated",
            });
        }

        res.status(200).json({
            success: true,
            message: "Booking status updated successfully",
        });
    } catch (error) {
        console.error("Update Booking Status Error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to update booking status",
        });
    }
};

// Customer: Cancel Own Booking
export const cancelBooking = async (req, res) => {
    try {
        const db = getDB();
        const { bookingId } = req.params;

        if (!ObjectId.isValid(bookingId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid booking ID",
            });
        }

        const result = await db.collection("bookings").updateOne(
            {
                _id: new ObjectId(bookingId),
                customerId: req.user.id,
                status: "requested",
            },
            {
                $set: {
                    status: "cancelled",
                    updatedAt: new Date(),
                },
            }
        );

        if (result.matchedCount === 0) {
            return res.status(400).json({
                success: false,
                message: "Booking cannot be cancelled. It may not belong to you or is no longer pending.",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Booking cancelled successfully",
        });
    } catch (error) {
        console.error("Cancel Booking Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to cancel booking",
        });
    }
};
