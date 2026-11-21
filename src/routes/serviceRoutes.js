
import express from "express";

import {
    getAllServices,
    getServiceById,
    getFeaturedServices,
    createService,
    getMyServices,
} from "../controllers/serviceController.js";

import { verifyToken } from "../middlewares/verifyToken.js";
import { verifyTechnician } from "../middlewares/verifyRole.js";

const router = express.Router();

router.get("/", getAllServices);

router.get("/featured", getFeaturedServices);

// Technician: Get own services
router.get(
    "/my-services",
    (req, res, next) => {
        console.log("MY-SERVICES ROUTE MATCHED");
        next();
    },
    verifyToken,
    verifyTechnician,
    (req, res, next) => {
        console.log("MY-SERVICES CONTROLLER CALLED");
        next();
    },
    getMyServices
);

// Public: Get single service details
router.get("/:serviceId", getServiceById);

router.post("/", verifyToken, verifyTechnician, createService);

export default router;
