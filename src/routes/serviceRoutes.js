
import express from "express";

import {
    getAllServices,
    getServiceById,
    getFeaturedServices,
    createService,
    getMyServices,
    updateService,
    deleteService,
} from "../controllers/serviceController.js";

import { verifyToken } from "../middlewares/verifyToken.js";
import { verifyTechnician } from "../middlewares/verifyRole.js";

const router = express.Router();

// Public: Get all approved and available services
router.get("/", getAllServices);

// Public: Get featured services
router.get("/featured", getFeaturedServices);

// Technician: Get own services
router.get(
    "/my-services",
    verifyToken,
    verifyTechnician,
    getMyServices
);

// Technician: Create service
router.post(
    "/",
    verifyToken,
    verifyTechnician,
    createService
);

// Technician: Update own service
router.patch(
    "/:serviceId",
    verifyToken,
    verifyTechnician,
    updateService
);

// Technician: Delete own service
router.delete(
    "/:serviceId",
    verifyToken,
    verifyTechnician,
    deleteService
);

// Public: Get single service details
router.get("/:serviceId", getServiceById);

export default router;
