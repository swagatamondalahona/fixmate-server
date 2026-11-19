
import { getDB } from "../config/db.js";

export const getFeaturedServices = async (req, res) => {
    try {
        const db = getDB();

        const services = await db
            .collection("services")
            .find({
                approvalStatus: "approved",
                isAvailable: true,
            })
            .sort({ createdAt: -1 })
            .limit(6)
            .toArray();

        res.status(200).json({
            success: true,
            message: "Featured services fetched successfully",
            data: services,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch featured services",
        });
    }
};
export const createService = async (req, res) => {
    try {
        const db = getDB();

        const {
            title,
            description,
            category,
            serviceMode,
            basePrice,
            image,
        } = req.body;

        // Required field validation
        if (
            !title ||
            !description ||
            !category ||
            !serviceMode ||
            basePrice === undefined
        ) {
            return res.status(400).json({
                success: false,
                message: "Please provide all required fields",
            });
        }

        const service = {
            title,
            description,
            category,
            serviceMode,
            basePrice: Number(basePrice),
            image: image || "",
            approvalStatus: "pending",
            isAvailable: true,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const result = await db
            .collection("services")
            .insertOne(service);

        res.status(201).json({
            success: true,
            message: "Service created successfully",
            data: {
                _id: result.insertedId,
                ...service,
            },
        });
    } catch (error) {
        console.error("Create Service Error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to create service",
        });
    }
};