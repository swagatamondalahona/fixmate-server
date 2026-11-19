import express from "express";

import {
    getFeaturedServices,
    createService,
} from "../controllers/serviceController.js";

const router = express.Router();

router.get("/featured", getFeaturedServices);

router.post("/", createService);

export default router;