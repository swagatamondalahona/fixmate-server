
import { getDB } from "../config/db.js";

async function checkRole(req, res, next, allowedRole) {
    try {
        const db = getDB();

        const user = await db.collection("users").findOne({
            $or: [
                { _id: req.user.id },
                { id: req.user.id },
            ],
        });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "User not found",
            });
        }

        if (user.role !== allowedRole) {
            return res.status(403).json({
                success: false,
                message: "Forbidden: Access denied",
            });
        }

        req.user.role = user.role;
        next();
    } catch (error) {
        console.error("Role verification error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
}

export function verifyCustomer(req, res, next) {
    return checkRole(req, res, next, "customer");
}

export function verifyTechnician(req, res, next) {
    return checkRole(req, res, next, "technician");
}

export function verifyAdmin(req, res, next) {
    return checkRole(req, res, next, "admin");
}
