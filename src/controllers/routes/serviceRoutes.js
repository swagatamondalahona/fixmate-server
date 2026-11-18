
import express from "express";
import { getFeaturedServices } from "../controllers/serviceController.js";

const router = express.Router();

router.get("/featured", getFeaturedServices);

export default router;
