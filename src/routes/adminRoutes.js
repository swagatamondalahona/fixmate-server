
import express from "express";

import {
    getPendingServices,
    approveService,
    rejectService,
} from "../controllers/serviceController.js";

import {
    getAllAdminServices,
} from "../controllers/adminServiceController.js";

import {
    getAllAdminBookings,
} from "../controllers/adminBookingController.js";

import {
    getAllUsers,
    updateUserRole,
} from "../controllers/userController.js";

import { verifyToken } from "../middlewares/verifyToken.js";
import { verifyAdmin } from "../middlewares/verifyRole.js";

const router = express.Router();

// All Admin routes require authentication and Admin role
router.use(verifyToken, verifyAdmin);

// Admin: Manage Services
router.get("/services", getAllAdminServices);
router.get("/services/pending", getPendingServices);
router.patch("/services/:serviceId/approve", approveService);
router.patch("/services/:serviceId/reject", rejectService);

// Admin: Manage Users
router.get("/users", getAllUsers);
router.patch("/users/:userId/role", updateUserRole);

// Admin: Manage Bookings
router.get("/bookings", getAllAdminBookings);

export default router;
