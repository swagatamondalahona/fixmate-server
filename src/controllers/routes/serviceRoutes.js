import express from "express";

import {
    getFeaturedServices,
    createService,
} from "../controllers/serviceController.js";

import { verifyToken } from "../middlewares/verifyToken.js";
import { verifyTechnician } from "../middlewares/verifyRole.js";

const router = express.Router();

router.get("/featured", getFeaturedServices);

router.post("/", verifyToken, verifyTechnician, createService);

export default router;