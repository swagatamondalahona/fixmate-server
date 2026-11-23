
import { getDB } from "../config/db.js";
import { ObjectId } from "mongodb";

const MIN_FINAL_AMOUNT_USD = 0.5;

// Customer: Create Booking
export const createBooking = async (req, res) => {
    try {
        const db = getDB();

        const { serviceId, bookingDate, address, notes } = req.body;

        // Validate required fields
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

        // Validate future booking date
        const selectedDate = new Date(bookingDate);

        if (
            Number.isNaN(selectedDate.getTime()) ||
            selectedDate <= new Date()
        ) {
            return res.status(400).json({
                success: false,
                message: "Please select a valid future booking date",
            });
        }

        // Find approved and available service
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

        // Prevent technicians from booking their own services
        const isOwnService =
            service.technicianId === req.user.id ||
            (
                service.technicianEmail &&
                req.user.email &&
                service.technicianEmail.toLowerCase() ===
                req.user.email.toLowerCase()
            );

        if (isOwnService) {
            return res.status(403).json({
                success: false,
                message: "You cannot book your own service",
            });
        }

        // Prevent duplicate active bookings
        const existingBooking = await db.collection("bookings").findOne({
            serviceId: service._id,
            customerId: req.user.id,
            status: {
                $in: ["requested", "accepted", "in-progress"],
            },
        });

        if (existingBooking) {
            return res.status(409).json({
                success: false,
                message: "You already have an active booking for this service",
            });
        }

        // Create booking
        const booking = {
            serviceId: service._id,
            serviceTitle: service.title,
            serviceImage: service.image || "",

            technicianId: service.technicianId,
            technicianEmail: service.technicianEmail || "",

            customerId: req.user.id,
            customerEmail: req.user.email || "",

            bookingDate: selectedDate,
            address: address.trim(),
            notes: notes || "",

            basePrice: service.basePrice,
            finalAmount: null,

            status: "requested",
            paymentStatus: "unpaid",

            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const result = await db.collection("bookings").insertOne(booking);

        return res.status(201).json({
            success: true,
            message: "Booking created successfully",
            data: {
                _id: result.insertedId,
                ...booking,
            },
        });
    } catch (error) {
        console.error("Create Booking Error:", error);

        return res.status(500).json({
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
            .find({
                customerId: req.user.id,
            })
            .sort({ createdAt: -1 })
            .toArray();

        return res.status(200).json({
            success: true,
            message: "Bookings fetched successfully",
            data: bookings,
        });
    } catch (error) {
        console.error("Get Customer Bookings Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch bookings",
        });
    }
};

// Technician: Get Own Booking Requests
export const getTechnicianBookings = async (req, res) => {
    try {
        const db = getDB();

        const bookings = await db
            .collection("bookings")
            .find({
                technicianId: req.user.id,
            })
            .sort({ createdAt: -1 })
            .toArray();

        return res.status(200).json({
            success: true,
            message: "Technician bookings fetched successfully",
            data: bookings,
        });
    } catch (error) {
        console.error("Get Technician Bookings Error:", error);

        return res.status(500).json({
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
                message: "Booking not found or access denied",
            });
        }

        // Allowed status transitions
        const allowedTransitions = {
            requested: ["accepted", "rejected"],
            accepted: ["in-progress"],
            "in-progress": ["completed"],
        };

        const allowedStatuses = allowedTransitions[booking.status] || [];

        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Invalid status transition from ${booking.status} to ${status}`,
            });
        }

        const updateData = {
            status,
            updatedAt: new Date(),
        };

        // Final amount is required when completing a booking
        if (status === "completed") {
            const amount = Number(finalAmount);

            if (!Number.isFinite(amount) || amount < MIN_FINAL_AMOUNT_USD) {
                return res.status(400).json({
                    success: false,
                    message: `Final amount must be at least $${MIN_FINAL_AMOUNT_USD.toFixed(2)} USD (Stripe minimum online payment requirement)`,
                });
            }

            updateData.finalAmount = amount;
            updateData.completedAt = new Date();
        }

        // Atomic ownership and status check
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

        if (result.matchedCount === 0) {
            return res.status(409).json({
                success: false,
                message: "Booking status has changed. Please refresh and try again",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Booking status updated successfully",
        });
    } catch (error) {
        console.error("Update Booking Status Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update booking status",
        });
    }
};

// Technician: Update Final Amount on Unpaid Completed Booking
export const updateCompletedBookingAmount = async (req, res) => {
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

        if (!Number.isFinite(amount) || amount < MIN_FINAL_AMOUNT_USD) {
            return res.status(400).json({
                success: false,
                message: `Final amount must be at least $${MIN_FINAL_AMOUNT_USD.toFixed(2)} USD (Stripe minimum online payment requirement)`,
            });
        }

        const result = await db.collection("bookings").updateOne(
            {
                _id: new ObjectId(bookingId),
                technicianId: req.user.id,
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
                message: "Unpaid completed booking not found or access denied",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Final amount updated successfully",
            data: { finalAmount: amount },
        });
    } catch (error) {
        console.error("Update Final Amount Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update final amount",
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
            return res.status(404).json({
                success: false,
                message: "Booking not found or cannot be cancelled",
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
