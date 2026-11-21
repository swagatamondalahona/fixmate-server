
import express from "express";

import {
    createCheckoutSession,
    verifyCheckoutSession,
    handleStripeWebhook,
    getMyPayments,
} from "../controllers/paymentController.js";

import { verifyToken } from "../middlewares/verifyToken.js";
import { verifyCustomer } from "../middlewares/verifyRole.js";

const router = express.Router();

// Stripe Webhook
// Raw body must be configured before express.json() in server.js.
router.post("/webhook", handleStripeWebhook);

// Customer: Create Stripe Checkout Session
router.post(
    "/create-checkout-session",
    verifyToken,
    verifyCustomer,
    createCheckoutSession
);

// Customer: Verify Stripe Checkout Session
router.post(
    "/verify-checkout-session",
    verifyToken,
    verifyCustomer,
    verifyCheckoutSession
);

// Customer: Get Payment History
router.get(
    "/my-payments",
    verifyToken,
    verifyCustomer,
    getMyPayments
);
console.log(
    "PAYMENT ROUTES:",
    router.stack.map((layer) => layer.route?.path).filter(Boolean)
);

export default router;
