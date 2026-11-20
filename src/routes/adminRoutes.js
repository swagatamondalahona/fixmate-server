
import express from "express";

import {
    getPendingServices,
    approveService,
    rejectService,
} from "../controllers/serviceController.js";

import {
    getAllUsers,
    updateUserRole,
} from "../controllers/userController.js";

import { verifyToken } from "../middlewares/verifyToken.js";
import { verifyAdmin } from "../middlewares/verifyRole.js";

const router = express.Router();

// All Admin routes require authentication and Admin role
router.use(verifyToken, verifyAdmin);

// Admin: Get Pending Services
router.get("/services/pending", getPendingServices);

// Admin: Approve Service
router.patch("/services/:serviceId/approve", approveService);

// Admin: Reject Service
router.patch("/services/:serviceId/reject", rejectService);

// Admin: Get All Users
router.get("/users", getAllUsers);

// Admin: Update User Role
router.patch("/users/:userId/role", updateUserRole);

export default router;
