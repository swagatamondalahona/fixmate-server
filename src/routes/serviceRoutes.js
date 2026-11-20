
import express from "express";

import {
    getAllServices,
    getFeaturedServices,
    createService,
} from "../controllers/serviceController.js";

import { verifyToken } from "../middlewares/verifyToken.js";
import { verifyTechnician } from "../middlewares/verifyRole.js";

const router = express.Router();

// Public: Get all approved and available services
router.get("/", getAllServices);


// Public: Get featured services
router.get("/featured", getFeaturedServices);

// Technician: Create service
router.post("/", verifyToken, verifyTechnician, createService);

export default router;
