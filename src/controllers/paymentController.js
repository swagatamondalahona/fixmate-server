
import { getDB } from "../config/db.js";
import { ObjectId } from "mongodb";
import { createHmac, timingSafeEqual } from "node:crypto";

// Customer: Create Stripe Checkout Session
export const createCheckoutSession = async (req, res) => {
    try {
        const db = getDB();

        const { bookingId } = req.body;

        if (!bookingId || !ObjectId.isValid(bookingId)) {
            return res.status(400).json({
                success: false,
                message: "Valid booking ID is required",
            });
        }

        const booking = await db.collection("bookings").findOne({
            _id: new ObjectId(bookingId),
            customerId: req.user.id,
            status: "completed",
            paymentStatus: "unpaid",
        });

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Completed unpaid booking not found",
            });
        }

        const amount = Number(booking.finalAmount);

        if (!Number.isFinite(amount) || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid booking amount",
            });
        }

        if (!process.env.STRIPE_SECRET_KEY) {
            return res.status(500).json({
                success: false,
                message: "Stripe is not configured",
            });
        }

        const frontendURL = process.env.FRONTEND_URL;

        if (!frontendURL) {
            return res.status(500).json({
                success: false,
                message: "Frontend URL is not configured",
            });
        }

        const currency = (
            process.env.STRIPE_CURRENCY || "usd"
        ).toLowerCase();

        const formData = new URLSearchParams();

        formData.append("mode", "payment");
        formData.append(
            "success_url",
            `${frontendURL}/dashboard/customer/bookings?payment=success`
        );
        formData.append(
            "cancel_url",
            `${frontendURL}/dashboard/customer/bookings?payment=cancelled`
        );

        formData.append(
            "line_items[0][price_data][currency]",
            currency
        );
        formData.append(
            "line_items[0][price_data][product_data][name]",
            booking.serviceTitle
        );
        formData.append(
            "line_items[0][price_data][unit_amount]",
            String(Math.round(amount * 100))
        );
        formData.append("line_items[0][quantity]", "1");

        formData.append("client_reference_id", bookingId);
        formData.append("metadata[bookingId]", bookingId);
        formData.append("metadata[customerId]", req.user.id);

        const stripeResponse = await fetch(
            "https://api.stripe.com/v1/checkout/sessions",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: formData,
            }
        );

        const session = await stripeResponse.json();

        if (!stripeResponse.ok) {
            console.error("Stripe Error:", session);

            return res.status(502).json({
                success: false,
                message: "Unable to create Stripe checkout session",
            });
        }

        res.status(200).json({
            success: true,
            message: "Checkout session created successfully",
            data: {
                sessionId: session.id,
                checkoutUrl: session.url,
            },
        });
    } catch (error) {
        console.error("Create Checkout Session Error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to create checkout session",
        });
    }
};

// Stripe Webhook Signature Verification
const verifyStripeSignature = (rawBody, signature) => {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!secret || !signature || !Buffer.isBuffer(rawBody)) {
        return false;
    }

    const signatureParts = signature.split(",");
    const timestamp = signatureParts
        .find((part) => part.startsWith("t="))
        ?.slice(2);

    const signatures = signatureParts
        .filter((part) => part.startsWith("v1="))
        .map((part) => part.slice(3));

    if (!timestamp || signatures.length === 0) {
        return false;
    }

    const signedPayload = `${timestamp}.${rawBody.toString("utf8")}`;

    const expectedSignature = createHmac("sha256", secret)
        .update(signedPayload)
        .digest("hex");

    return signatures.some((signatureValue) => {
        const expected = Buffer.from(expectedSignature, "hex");
        const received = Buffer.from(signatureValue, "hex");

        return (
            expected.length === received.length &&
            timingSafeEqual(expected, received)
        );
    });
};

// Stripe Webhook
export const handleStripeWebhook = async (req, res) => {
    try {
        const signature = req.headers["stripe-signature"];

        if (!verifyStripeSignature(req.body, signature)) {
            return res.status(400).json({
                success: false,
                message: "Invalid Stripe webhook signature",
            });
        }

        const event = JSON.parse(req.body.toString("utf8"));

        if (event.type === "checkout.session.completed") {
            const session = event.data.object;

            if (session.payment_status !== "paid") {
                return res.status(200).json({
                    received: true,
                    message: "Payment is not completed",
                });
            }

            const db = getDB();

            const bookingId = session.metadata?.bookingId;
            const customerId = session.metadata?.customerId;

            if (
                !bookingId ||
                !ObjectId.isValid(bookingId) ||
                !customerId
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid booking metadata",
                });
            }

            const booking = await db.collection("bookings").findOne({
                _id: new ObjectId(bookingId),
                customerId,
                status: "completed",
                paymentStatus: "unpaid",
            });

            if (!booking) {
                // Already processed or not an eligible booking.
                return res.status(200).json({
                    received: true,
                    message: "Booking already processed or not eligible",
                });
            }

            const payment = {
                bookingId: booking._id,
                customerId,
                stripeSessionId: session.id,
                stripePaymentIntent: session.payment_intent || null,
                amount: session.amount_total / 100,
                currency: session.currency,
                status: "paid",
                createdAt: new Date(),
            };

            // Prevent duplicate payment records for the same booking.
            await db.collection("payments").updateOne(
                { stripeSessionId: session.id },
                { $setOnInsert: payment },
                { upsert: true }
            );

            // Only one webhook can change an unpaid booking to paid.
            await db.collection("bookings").updateOne(
                {
                    _id: booking._id,
                    customerId,
                    status: "completed",
                    paymentStatus: "unpaid",
                },
                {
                    $set: {
                        paymentStatus: "paid",
                        paidAt: new Date(),
                        updatedAt: new Date(),
                    },
                }
            );
        }

        res.status(200).json({ received: true });
    } catch (error) {
        console.error("Stripe Webhook Error:", error);

        res.status(500).json({
            success: false,
            message: "Webhook processing failed",
        });
    }
};
