
import express from "express";

import {
    approveService,
    rejectService,
} from "../controllers/serviceController.js";

import { verifyToken } from "../middlewares/verifyToken.js";
import { verifyAdmin } from "../middlewares/verifyRole.js";

const router = express.Router();

// Admin: Approve Pending Service
router.patch(
    "/services/:serviceId/approve",
    verifyToken,
    verifyAdmin,
    approveService
);

// Admin: Reject Pending Service
router.patch(
    "/services/:serviceId/reject",
    verifyToken,
    verifyAdmin,
    rejectService
);

export default router;
