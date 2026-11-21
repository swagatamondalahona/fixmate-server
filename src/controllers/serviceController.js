
import { getDB } from "../config/db.js";
import { ObjectId } from "mongodb";

// Helper: Find technician by ID or email
const findTechnician = async (db, service) => {
    const conditions = [];

    if (service.technicianId) {
        conditions.push(
            { _id: service.technicianId },
            { id: service.technicianId }
        );

        if (ObjectId.isValid(service.technicianId)) {
            conditions.push({
                _id: new ObjectId(service.technicianId),
            });
        }
    }

    if (service.technicianEmail) {
        conditions.push({
            email: service.technicianEmail,
        });
    }

    if (conditions.length === 0) return null;

    return db.collection("users").findOne({
        $or: conditions,
    });
};

// Helper: Get technician name
const getTechnicianName = (technician) => {
    return (
        technician?.name?.trim() ||
        technician?.fullName?.trim() ||
        technician?.displayName?.trim() ||
        ""
    );
};

// Public: Get All Approved and Available Services
export const getAllServices = async (req, res) => {
    try {
        const db = getDB();
        const { search, category, mode, sort } = req.query;

        const query = {
            approvalStatus: "approved",
            isAvailable: true,
        };

        if (search?.trim()) {
            const safeSearch = search
                .trim()
                .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

            query.$or = [
                { title: { $regex: safeSearch, $options: "i" } },
                { category: { $regex: safeSearch, $options: "i" } },
            ];
        }

        if (category?.trim() && category !== "All Categories") {
            query.category = category.trim();
        }

        if (mode?.trim() && mode !== "All Modes") {
            query.serviceMode = mode.trim();
        }

        let sortOption = { createdAt: -1 };

        if (sort === "low-high") {
            sortOption = { basePrice: 1 };
        } else if (sort === "high-low") {
            sortOption = { basePrice: -1 };
        }

        const services = await db
            .collection("services")
            .find(query)
            .sort(sortOption)
            .toArray();

        return res.status(200).json({
            success: true,
            message: "Services fetched successfully",
            total: services.length,
            data: services,
        });
    } catch (error) {
        console.error("Get all services error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch services",
        });
    }
};

// Public: Get Single Approved and Available Service
export const getServiceById = async (req, res) => {
    try {
        const db = getDB();
        const { serviceId } = req.params;

        if (!ObjectId.isValid(serviceId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid service ID",
            });
        }

        const service = await db.collection("services").findOne({
            _id: new ObjectId(serviceId),
            approvalStatus: "approved",
            isAvailable: true,
        });

        if (!service) {
            return res.status(404).json({
                success: false,
                message: "Service not found",
            });
        }

        const technician = await findTechnician(db, service);

        return res.status(200).json({
            success: true,
            message: "Service fetched successfully",
            data: {
                ...service,
                technicianName:
                    service.technicianName?.trim() ||
                    getTechnicianName(technician) ||
                    "Verified Technician",
            },
        });
    } catch (error) {
        console.error("Get service by ID error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch service",
        });
    }
};

// Public: Get Featured Services
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

        const updatedServices = await Promise.all(
            services.map(async (service) => {
                const technician = await findTechnician(db, service);

                return {
                    ...service,
                    technicianName:
                        service.technicianName?.trim() ||
                        getTechnicianName(technician) ||
                        "Verified Technician",
                };
            })
        );

        return res.status(200).json({
            success: true,
            message: "Featured services fetched successfully",
            data: updatedServices,
        });
    } catch (error) {
        console.error("Featured services error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch featured services",
        });
    }
};

// Technician: Create Service
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
            estimatedDuration,
            serviceArea,
        } = req.body;

        if (
            !title?.trim() ||
            !description?.trim() ||
            !category?.trim() ||
            !serviceMode?.trim() ||
            !estimatedDuration?.trim() ||
            !serviceArea?.trim() ||
            basePrice === undefined ||
            !Number.isFinite(Number(basePrice)) ||
            Number(basePrice) < 0 ||
            !image?.trim()
        ) {
            return res.status(400).json({
                success: false,
                message: "Please provide all required service information",
            });
        }

        if (!req.user?.id) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
        }

        const userConditions = [
            { _id: req.user.id },
            { id: req.user.id },
        ];

        if (ObjectId.isValid(req.user.id)) {
            userConditions.push({
                _id: new ObjectId(req.user.id),
            });
        }

        if (req.user.email) {
            userConditions.push({
                email: req.user.email,
            });
        }

        const technician = await db.collection("users").findOne({
            $or: userConditions,
        });

        if (!technician) {
            return res.status(404).json({
                success: false,
                message: "Technician profile not found",
            });
        }

        if (technician.role !== "technician") {
            return res.status(403).json({
                success: false,
                message: "Only technicians can create services",
            });
        }

        const technicianName =
            getTechnicianName(technician);

        const service = {
            title: title.trim(),
            description: description.trim(),
            category: category.trim(),
            serviceMode: serviceMode.trim(),
            basePrice: Number(basePrice),
            image: image.trim(),
            estimatedDuration: estimatedDuration.trim(),
            serviceArea: serviceArea.trim(),
            technicianId: req.user.id,
            technicianName,
            technicianEmail: technician.email || req.user.email || "",
            approvalStatus: "pending",
            isAvailable: true,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const result = await db
            .collection("services")
            .insertOne(service);

        return res.status(201).json({
            success: true,
            message: "Service created and submitted for approval",
            data: {
                _id: result.insertedId,
                ...service,
            },
        });
    } catch (error) {
        console.error("Create service error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to create service",
        });
    }
};

// Technician: Get Own Services
export const getMyServices = async (req, res) => {
    try {
        const db = getDB();

        if (!req.user?.id) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
        }

        const services = await db
            .collection("services")
            .find({
                technicianId: req.user.id,
            })
            .sort({ createdAt: -1 })
            .toArray();

        return res.status(200).json({
            success: true,
            message: "My services fetched successfully",
            total: services.length,
            data: services,
        });
    } catch (error) {
        console.error("Get my services error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch your services",
        });
    }
};

// Admin: Approve Service
export const approveService = async (req, res) => {
    try {
        const db = getDB();
        const { serviceId } = req.params;

        if (!ObjectId.isValid(serviceId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid service ID",
            });
        }

        const result = await db.collection("services").updateOne(
            {
                _id: new ObjectId(serviceId),
                approvalStatus: "pending",
            },
            {
                $set: {
                    approvalStatus: "approved",
                    updatedAt: new Date(),
                },
            }
        );

        if (!result.matchedCount) {
            return res.status(404).json({
                success: false,
                message: "Pending service not found",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Service approved successfully",
        });
    } catch (error) {
        console.error("Approve service error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to approve service",
        });
    }
};

// Admin: Reject Service
export const rejectService = async (req, res) => {
    try {
        const db = getDB();
        const { serviceId } = req.params;

        if (!ObjectId.isValid(serviceId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid service ID",
            });
        }

        const result = await db.collection("services").updateOne(
            {
                _id: new ObjectId(serviceId),
                approvalStatus: "pending",
            },
            {
                $set: {
                    approvalStatus: "rejected",
                    updatedAt: new Date(),
                },
            }
        );

        if (!result.matchedCount) {
            return res.status(404).json({
                success: false,
                message: "Pending service not found",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Service rejected successfully",
        });
    } catch (error) {
        console.error("Reject service error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to reject service",
        });
    }
};

// Admin: Get Pending Services
export const getPendingServices = async (req, res) => {
    try {
        const db = getDB();

        const services = await db
            .collection("services")
            .find({ approvalStatus: "pending" })
            .sort({ createdAt: -1 })
            .toArray();

        return res.status(200).json({
            success: true,
            message: "Pending services fetched successfully",
            data: services,
        });
    } catch (error) {
        console.error("Pending services error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch pending services",
        });
    }
};
