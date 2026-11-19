
import express from "express";

import {
    createCheckoutSession,
    handleStripeWebhook,
} from "../controllers/paymentController.js";

import { verifyToken } from "../middlewares/verifyToken.js";
import { verifyCustomer } from "../middlewares/verifyRole.js";

const router = express.Router();

// Stripe Webhook
// Must receive raw request body; configure express.raw() in server.js
router.post(
    "/webhook",
    express.raw({ type: "application/json" }),
    handleStripeWebhook
);

// Customer: Create Stripe Checkout Session
router.post(
    "/create-checkout-session",
    verifyToken,
    verifyCustomer,
    createCheckoutSession
);

export default router;
