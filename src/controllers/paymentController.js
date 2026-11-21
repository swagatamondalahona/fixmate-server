
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
                message: "Invalid booking ID",
            });
        }

        const booking = await db.collection("bookings").findOne({
            _id: new ObjectId(bookingId),
            customerId: req.user.id,
            status: "completed",
        });

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Completed booking not found",
            });
        }

        if (
            booking.paymentStatus === "paid" ||
            booking.paymentStatus === "completed"
        ) {
            return res.status(400).json({
                success: false,
                message: "This booking has already been paid",
            });
        }

        const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

        if (!stripeSecretKey) {
            return res.status(500).json({
                success: false,
                message: "Stripe configuration is missing",
            });
        }

        const amount = Number(booking.price || booking.amount);

        if (!Number.isFinite(amount) || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid booking amount",
            });
        }

        const frontendURL =
            process.env.CLIENT_URL ||
            process.env.NEXT_PUBLIC_APP_URL ||
            "http://localhost:3000";

        const formData = new URLSearchParams();

        formData.append("mode", "payment");
        formData.append(
            "success_url",
            `${frontendURL}/dashboard/customer/payments?session_id={CHECKOUT_SESSION_ID}`
        );
        formData.append(
            "cancel_url",
            `${frontendURL}/dashboard/customer/bookings`
        );

        formData.append(
            "line_items[0][price_data][currency]",
            "bdt"
        );
        formData.append(
            "line_items[0][price_data][product_data][name]",
            booking.serviceTitle || "FixMate Service"
        );
        formData.append(
            "line_items[0][price_data][unit_amount]",
            String(Math.round(amount * 100))
        );
        formData.append("line_items[0][quantity]", "1");

        formData.append("metadata[bookingId]", booking._id.toString());
        formData.append("metadata[customerId]", req.user.id);

        const stripeResponse = await fetch(
            "https://api.stripe.com/v1/checkout/sessions",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${stripeSecretKey}`,
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: formData,
            }
        );

        const session = await stripeResponse.json();

        if (!stripeResponse.ok) {
            console.error("Stripe Checkout Error:", session);

            return res.status(400).json({
                success: false,
                message:
                    session.error?.message ||
                    "Failed to create checkout session",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Checkout session created successfully",
            sessionId: session.id,
            checkoutUrl: session.url,
        });
    } catch (error) {
        console.error("Create Checkout Session Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to create checkout session",
        });
    }
};


// Customer: Verify Stripe Checkout Session
export const verifyCheckoutSession = async (req, res) => {
    try {
        const db = getDB();
        const { sessionId } = req.body;

        if (!sessionId || !sessionId.startsWith("cs_test_")) {
            return res.status(400).json({
                success: false,
                message: "Invalid Stripe session ID",
            });
        }

        const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

        if (!stripeSecretKey) {
            return res.status(500).json({
                success: false,
                message: "Stripe configuration is missing",
            });
        }

        const stripeResponse = await fetch(
            `https://api.stripe.com/v1/checkout/sessions/${sessionId}`,
            {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${stripeSecretKey}`,
                },
            }
        );

        const session = await stripeResponse.json();

        if (!stripeResponse.ok) {
            return res.status(400).json({
                success: false,
                message:
                    session.error?.message ||
                    "Unable to verify Stripe session",
            });
        }

        if (session.payment_status !== "paid") {
            return res.status(400).json({
                success: false,
                message: "Payment has not been completed",
            });
        }

        const bookingId = session.metadata?.bookingId;
        const customerId = session.metadata?.customerId;

        if (
            !bookingId ||
            !ObjectId.isValid(bookingId) ||
            customerId !== req.user.id
        ) {
            return res.status(403).json({
                success: false,
                message: "Payment ownership verification failed",
            });
        }

        const booking = await db.collection("bookings").findOne({
            _id: new ObjectId(bookingId),
            customerId: req.user.id,
        });

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found",
            });
        }

        const expectedAmount = Math.round(
            Number(booking.price || booking.amount) * 100
        );

        if (
            session.amount_total !== expectedAmount ||
            session.currency !== "bdt"
        ) {
            return res.status(400).json({
                success: false,
                message: "Payment amount verification failed",
            });
        }

        const payment = {
            bookingId: new ObjectId(bookingId),
            customerId: req.user.id,
            serviceTitle: booking.serviceTitle || "FixMate Service",
            customerName: booking.customerName || "",
            customerEmail: booking.customerEmail || req.user.email || "",
            technicianName: booking.technicianName || "",
            technicianEmail: booking.technicianEmail || "",
            transactionId:
                session.payment_intent || session.id,
            stripeSessionId: session.id,
            stripePaymentIntent: session.payment_intent || null,
            amount: Number(session.amount_total) / 100,
            currency: session.currency,
            status: "paid",
            paymentStatus: "paid",
            paidAt: new Date(
                (session.created || Math.floor(Date.now() / 1000)) * 1000
            ),
            createdAt: new Date(),
        };

        await db.collection("payments").updateOne(
            { stripeSessionId: session.id },
            { $setOnInsert: payment },
            { upsert: true }
        );

        await db.collection("bookings").updateOne(
            { _id: new ObjectId(bookingId) },
            {
                $set: {
                    paymentStatus: "paid",
                    paidAt: payment.paidAt,
                },
            }
        );

        return res.status(200).json({
            success: true,
            message: "Payment verified successfully",
            data: {
                transactionId: payment.transactionId,
                amount: payment.amount,
                currency: payment.currency,
                paymentStatus: "paid",
            },
        });
    } catch (error) {
        console.error("Verify Checkout Session Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to verify payment",
        });
    }
};


// Stripe Webhook: Verify Signature
const verifyStripeSignature = (payload, signature, secret) => {
    try {
        if (!signature || !secret) return false;

        const elements = signature.split(",");
        const timestamp = elements
            .find((item) => item.startsWith("t="))
            ?.slice(2);

        const signatures = elements
            .filter((item) => item.startsWith("v1="))
            .map((item) => item.slice(3));

        if (!timestamp || signatures.length === 0) return false;

        const signedPayload = `${timestamp}.${payload}`;

        const expectedSignature = createHmac("sha256", secret)
            .update(signedPayload)
            .digest("hex");

        return signatures.some((signatureValue) => {
            const expectedBuffer = Buffer.from(
                expectedSignature,
                "hex"
            );
            const receivedBuffer = Buffer.from(
                signatureValue,
                "hex"
            );

            return (
                expectedBuffer.length === receivedBuffer.length &&
                timingSafeEqual(expectedBuffer, receivedBuffer)
            );
        });
    } catch {
        return false;
    }
};


// Stripe Webhook
export const handleStripeWebhook = async (req, res) => {
    try {
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
        const signature = req.headers["stripe-signature"];

        if (!webhookSecret) {
            return res.status(500).json({
                success: false,
                message: "Stripe webhook configuration is missing",
            });
        }

        const rawBody = Buffer.isBuffer(req.body)
            ? req.body.toString("utf8")
            : "";

        const isValid = verifyStripeSignature(
            rawBody,
            signature,
            webhookSecret
        );

        if (!isValid) {
            return res.status(400).json({
                success: false,
                message: "Invalid Stripe signature",
            });
        }

        const event = JSON.parse(rawBody);

        if (event.type === "checkout.session.completed") {
            const session = event.data.object;

            if (session.payment_status !== "paid") {
                return res.status(200).json({
                    received: true,
                });
            }

            const bookingId = session.metadata?.bookingId;
            const customerId = session.metadata?.customerId;

            if (
                !bookingId ||
                !ObjectId.isValid(bookingId) ||
                !customerId
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid payment metadata",
                });
            }

            const db = getDB();

            const booking = await db.collection("bookings").findOne({
                _id: new ObjectId(bookingId),
                customerId,
            });

            if (!booking) {
                return res.status(404).json({
                    success: false,
                    message: "Booking not found",
                });
            }

            const expectedAmount = Math.round(
                Number(booking.price || booking.amount) * 100
            );

            if (
                session.amount_total !== expectedAmount ||
                session.currency !== "bdt"
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Payment amount verification failed",
                });
            }

            const payment = {
                bookingId: new ObjectId(bookingId),
                customerId,
                serviceTitle: booking.serviceTitle || "FixMate Service",
                customerName: booking.customerName || "",
                customerEmail: booking.customerEmail || "",
                technicianName: booking.technicianName || "",
                technicianEmail: booking.technicianEmail || "",
                transactionId:
                    session.payment_intent || session.id,
                stripeSessionId: session.id,
                stripePaymentIntent: session.payment_intent || null,
                amount: Number(session.amount_total) / 100,
                currency: session.currency,
                status: "paid",
                paymentStatus: "paid",
                paidAt: new Date(
                    (session.created || Math.floor(Date.now() / 1000)) * 1000
                ),
                createdAt: new Date(),
            };

            await db.collection("payments").updateOne(
                { stripeSessionId: session.id },
                { $setOnInsert: payment },
                { upsert: true }
            );

            await db.collection("bookings").updateOne(
                { _id: new ObjectId(bookingId) },
                {
                    $set: {
                        paymentStatus: "paid",
                        paidAt: payment.paidAt,
                    },
                }
            );
        }

        return res.status(200).json({
            received: true,
        });
    } catch (error) {
        console.error("Stripe Webhook Error:", error);

        return res.status(500).json({
            success: false,
            message: "Webhook handling failed",
        });
    }
};


// Customer: Get Payment History
export const getMyPayments = async (req, res) => {
    try {
        const db = getDB();

        const payments = await db
            .collection("payments")
            .find({
                customerId: req.user.id,
                paymentStatus: "paid",
            })
            .sort({ paidAt: -1 })
            .toArray();

        const totalAmount = payments.reduce(
            (total, payment) =>
                total + Number(payment.amount || 0),
            0
        );

        return res.status(200).json({
            success: true,
            message: "Payment history fetched successfully",
            data: {
                payments,
                totalPayments: payments.length,
                totalAmount,
            },
        });
    } catch (error) {
        console.error("Get Payment History Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch payment history",
        });
    }
};
