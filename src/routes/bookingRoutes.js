
import express from "express";

import {
    createBooking,
    getMyBookings,
    getTechnicianBookings,
    updateBookingStatus,
    updateCompletedBookingAmount,
    cancelBooking,
} from "../controllers/bookingController.js";

import { verifyToken } from "../middlewares/verifyToken.js";

import {
    verifyCustomer,
    verifyTechnician,
} from "../middlewares/verifyRole.js";

const router = express.Router();

// Customer: Create Booking
router.post("/", verifyToken, verifyCustomer, createBooking);

// Customer: Get Own Bookings
router.get(
    "/my-bookings",
    verifyToken,
    verifyCustomer,
    getMyBookings
);

// Customer: Cancel Own Requested Booking
router.patch(
    "/:bookingId/cancel",
    verifyToken,
    verifyCustomer,
    cancelBooking
);

// Technician: Get Assigned Bookings
router.get(
    "/technician",
    verifyToken,
    verifyTechnician,
    getTechnicianBookings
);

// Technician: Update Booking Status
router.patch(
    "/:bookingId/status",
    verifyToken,
    verifyTechnician,
    updateBookingStatus
);

// Technician: Update Final Amount on Unpaid Completed Booking
router.patch(
    "/:bookingId/final-amount",
    verifyToken,
    verifyTechnician,
    updateCompletedBookingAmount
);

export default router;
