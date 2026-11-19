
import express from "express";

import {
    getMyProfile,
    updateMyProfile,
} from "../controllers/userController.js";

import { verifyToken } from "../middlewares/verifyToken.js";

const router = express.Router();

// Get Logged-in User Profile
router.get("/profile", verifyToken, getMyProfile);

// Update Logged-in User Profile
router.patch("/profile", verifyToken, updateMyProfile);

export default router;
