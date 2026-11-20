
import { getDB } from "../config/db.js";
import { ObjectId } from "mongodb";

// Get Logged-in User Profile
export const getMyProfile = async (req, res) => {
    try {
        const db = getDB();

        const user = await db.collection("users").findOne(
            {
                $or: [
                    { _id: req.user.id },
                    { id: req.user.id },
                ],
            },
            {
                projection: { password: 0 },
            }
        );

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User profile not found",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Profile fetched successfully",
            data: user,
        });
    } catch (error) {
        console.error("Get Profile Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch profile",
        });
    }
};

// Update Logged-in User Profile
export const updateMyProfile = async (req, res) => {
    try {
        const db = getDB();
        const { name, image, phone, area, bio } = req.body;

        const allowedUpdates = {};

        if (typeof name === "string" && name.trim()) {
            allowedUpdates.name = name.trim();
        }

        if (typeof image === "string") {
            allowedUpdates.image = image;
        }

        if (typeof phone === "string") {
            allowedUpdates.phone = phone.trim();
        }

        if (typeof area === "string") {
            allowedUpdates.area = area.trim();
        }

        if (typeof bio === "string") {
            allowedUpdates.bio = bio.trim();
        }

        if (Object.keys(allowedUpdates).length === 0) {
            return res.status(400).json({
                success: false,
                message: "No valid profile fields provided",
            });
        }

        allowedUpdates.updatedAt = new Date();

        const result = await db.collection("users").updateOne(
            {
                $or: [
                    { _id: req.user.id },
                    { id: req.user.id },
                ],
            },
            { $set: allowedUpdates }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({
                success: false,
                message: "User profile not found",
            });
        }

        const updatedUser = await db.collection("users").findOne(
            {
                $or: [
                    { _id: req.user.id },
                    { id: req.user.id },
                ],
            },
            {
                projection: { password: 0 },
            }
        );

        return res.status(200).json({
            success: true,
            message: "Profile updated successfully",
            data: updatedUser,
        });
    } catch (error) {
        console.error("Update Profile Error:", error);

        return res.status(500).json({
            success: true,
            message: "Failed to update profile",
        });
    }
};

// Admin: Get All Users
export const getAllUsers = async (req, res) => {
    try {
        const db = getDB();

        const users = await db.collection("users")
            .find(
                {},
                {
                    projection: {
                        password: 0,
                        token: 0,
                    },
                }
            )
            .sort({ createdAt: -1 })
            .toArray();

        return res.status(200).json({
            success: true,
            message: "Users fetched successfully",
            data: users,
        });
    } catch (error) {
        console.error("Get All Users Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch users",
        });
    }
};

// Admin: Update User Role
export const updateUserRole = async (req, res) => {
    try {
        const db = getDB();
        const { userId } = req.params;
        const { role } = req.body;

        if (!["customer", "technician"].includes(role)) {
            return res.status(400).json({
                success: false,
                message: "Invalid role. Only customer or technician is allowed.",
            });
        }

        if (userId === req.user.id) {
            return res.status(403).json({
                success: false,
                message: "You cannot change your own role.",
            });
        }

        const userQuery = ObjectId.isValid(userId)
            ? {
                $or: [
                    { _id: userId },
                    { _id: new ObjectId(userId) },
                    { id: userId },
                ],
            }
            : {
                $or: [
                    { _id: userId },
                    { id: userId },
                ],
            };

        const targetUser = await db.collection("users").findOne(userQuery);

        if (!targetUser) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        if (targetUser.role === "admin") {
            return res.status(403).json({
                success: false,
                message: "Admin role cannot be changed.",
            });
        }

        await db.collection("users").updateOne(
            userQuery,
            {
                $set: {
                    role,
                    updatedAt: new Date(),
                },
            }
        );

        return res.status(200).json({
            success: true,
            message: "User role updated successfully",
        });
    } catch (error) {
        console.error("Update User Role Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update user role",
        });
    }
};
