
import { getDB } from "../config/db.js";
import { ObjectId } from "mongodb";
import { createHmac, timingSafeEqual } from "node:crypto";

// Validate Stripe session amount and currency
const validateSessionAmount = (session, booking) => {
    const expectedAmount = Math.round(
        Number(booking.finalAmount) * 100
    );

    return (
        Number.isFinite(expectedAmount) &&
        expectedAmount > 0 &&
        session.amount_total === expectedAmount &&
        session.currency === "bdt"
    );
};

// Save verified payment
const saveVerifiedPayment = async (db, session, booking, customerId) => {
    if (
        !booking ||
        booking.status !== "completed" ||
        !validateSessionAmount(session, booking)
    ) {
        throw new Error("Payment verification failed");
    }

    const bookingId = booking._id;

    const existingPayment = await db.collection("payments").findOne({
        bookingId,
    });

    if (
        existingPayment &&
        existingPayment.stripeSessionId !== session.id
    ) {
        throw new Error("This booking already has a payment record");
    }

    const paidAt = new Date(
        (session.created || Math.floor(Date.now() / 1000)) * 1000
    );

    const bookingUpdate = await db.collection("bookings").updateOne(
        {
            _id: bookingId,
            customerId,
            status: "completed",
            paymentStatus: { $nin: ["paid", "completed"] },
        },
        {
            $set: {
                paymentStatus: "paid",
                paidAt,
                stripeSessionId: session.id,
            },
        }
    );

    if (bookingUpdate.matchedCount === 0) {
        const latestBooking = await db.collection("bookings").findOne({
            _id: bookingId,
            customerId,
        });

        if (
            !latestBooking ||
            latestBooking.paymentStatus !== "paid" ||
            latestBooking.stripeSessionId !== session.id
        ) {
            throw new Error("Booking is already paid or unavailable");
        }
    }

    const payment = {
        bookingId,
        customerId,
        serviceTitle: booking.serviceTitle || "FixMate Service",
        customerName: booking.customerName || "",
        customerEmail: booking.customerEmail || "",
        technicianName: booking.technicianName || "",
        technicianEmail: booking.technicianEmail || "",
        transactionId:
            typeof session.payment_intent === "string"
                ? session.payment_intent
                : session.id,
        stripeSessionId: session.id,
        stripePaymentIntent:
            typeof session.payment_intent === "string"
                ? session.payment_intent
                : null,
        amount: Number(session.amount_total) / 100,
        currency: session.currency,
        status: "paid",
        paymentStatus: "paid",
        paidAt,
        createdAt: new Date(),
    };

    await db.collection("payments").updateOne(
        { bookingId },
        { $setOnInsert: payment },
        { upsert: true }
    );

    return payment;
};

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

        const amount = Number(booking.finalAmount);

        if (!Number.isFinite(amount) || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid booking amount",
            });
        }

        const frontendURL = (
            process.env.CLIENT_URL ||
            process.env.NEXT_PUBLIC_APP_URL ||
            "http://localhost:3000"
        ).replace(/\/+$/, "");

        const formData = new URLSearchParams();

        formData.append("mode", "payment");
        formData.append(
            "success_url",
            `${frontendURL}/payment/success?session_id={CHECKOUT_SESSION_ID}`
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
            data: {
                sessionId: session.id,
                checkoutUrl: session.url,
            },
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

        if (
            typeof sessionId !== "string" ||
            !/^cs_(test|live)_/.test(sessionId)
        ) {
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
            `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
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

        if (
            session.id !== sessionId ||
            session.mode !== "payment" ||
            session.payment_status !== "paid"
        ) {
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

        if (
            booking.status !== "completed" ||
            !validateSessionAmount(session, booking)
        ) {
            return res.status(400).json({
                success: false,
                message: "Payment amount or booking verification failed",
            });
        }

        const payment = await saveVerifiedPayment(
            db,
            session,
            booking,
            req.user.id
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

        return res.status(400).json({
            success: false,
            message: error.message || "Failed to verify payment",
        });
    }
};

// Stripe Webhook Signature Verification
const verifyStripeSignature = (payload, signature, secret) => {
    try {
        if (!signature || !secret || typeof signature !== "string") {
            return false;
        }

        const elements = signature.split(",");

        const timestamp = elements
            .find((item) => item.startsWith("t="))
            ?.slice(2);

        const signatures = elements
            .filter((item) => item.startsWith("v1="))
            .map((item) => item.slice(3));

        if (!timestamp || signatures.length === 0) {
            return false;
        }

        const timestampNumber = Number(timestamp);

        if (!Number.isFinite(timestampNumber)) {
            return false;
        }

        const currentTimestamp = Math.floor(Date.now() / 1000);

        if (Math.abs(currentTimestamp - timestampNumber) > 300) {
            return false;
        }

        const signedPayload = `${timestamp}.${payload}`;

        const expectedSignature = createHmac("sha256", secret)
            .update(signedPayload)
            .digest("hex");

        const expectedBuffer = Buffer.from(expectedSignature, "hex");

        return signatures.some((signatureValue) => {
            if (!/^[a-f0-9]+$/i.test(signatureValue)) {
                return false;
            }

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

        if (!rawBody) {
            return res.status(400).json({
                success: false,
                message: "Invalid webhook request body",
            });
        }

        if (
            !verifyStripeSignature(
                rawBody,
                signature,
                webhookSecret
            )
        ) {
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

            await saveVerifiedPayment(
                db,
                session,
                booking,
                customerId
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
