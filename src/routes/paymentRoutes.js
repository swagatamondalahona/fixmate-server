
import express from "express";

import {
    createCheckoutSession,
    handleStripeWebhook,
} from "../controllers/paymentController.js";

import { verifyToken } from "../middlewares/verifyToken.js";
import { verifyCustomer } from "../middlewares/verifyRole.js";

const router = express.Router();

// Stripe Webhook
// Raw body is configured in server.js before express.json().
router.post("/webhook", handleStripeWebhook);

// Customer: Create Stripe Checkout Session
router.post(
    "/create-checkout-session",
    verifyToken,
    verifyCustomer,
    createCheckoutSession
);

export default router;
