
import { getDB } from "../config/db.js";

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
                projection: {
                    password: 0,
                },
            }
        );

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User profile not found",
            });
        }

        res.status(200).json({
            success: true,
            message: "Profile fetched successfully",
            data: user,
        });
    } catch (error) {
        console.error("Get Profile Error:", error);

        res.status(500).json({
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
            {
                $set: allowedUpdates,
            }
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
                projection: {
                    password: 0,
                },
            }
        );

        res.status(200).json({
            success: true,
            message: "Profile updated successfully",
            data: updatedUser,
        });
    } catch (error) {
        console.error("Update Profile Error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to update profile",
        });
    }
};
