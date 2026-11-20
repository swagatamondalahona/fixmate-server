
import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";

console.log("VERIFY ROLE FILE LOADED");

async function checkRole(req, res, next, allowedRole) {
    console.log("VERIFY ROLE MIDDLEWARE REACHED:", {
        userId: req.user?.id,
        allowedRole,
    });

    try {
        const db = getDB();
        const userId = req.user.id;

        const conditions = [
            { _id: userId },
            { id: userId },
        ];

        if (ObjectId.isValid(userId)) {
            conditions.push({
                _id: new ObjectId(userId),
            });
        }

        const user = await db.collection("users").findOne({
            $or: conditions,
        });

        console.log("ROLE VERIFICATION RESULT:", {
            userFound: Boolean(user),
            userId,
            actualRole: user?.role ?? null,
            expectedRole: allowedRole,
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

        console.log("ROLE VERIFICATION SUCCESS:", user.role);

        return next();

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
