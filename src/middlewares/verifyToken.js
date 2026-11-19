
import { createPublicKey, verify } from "node:crypto";

const JWKS_URL = "http://localhost:3000/api/auth/jwks";
const ISSUER = "http://localhost:3000";

let cachedKeys = [];
let keysFetchedAt = 0;

async function getPublicKeys() {
    const now = Date.now();

    if (cachedKeys.length && now - keysFetchedAt < 3600000) {
        return cachedKeys;
    }

    const response = await fetch(JWKS_URL);

    if (!response.ok) {
        throw new Error("Unable to fetch JWKS");
    }

    const data = await response.json();

    cachedKeys = data.keys || [];
    keysFetchedAt = now;

    return cachedKeys;
}

export async function verifyToken(req, res, next) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized: Token is required",
            });
        }

        const token = authHeader.split(" ")[1];
        const parts = token.split(".");

        if (parts.length !== 3) {
            return res.status(401).json({
                success: false,
                message: "Invalid token",
            });
        }

        const [headerPart, payloadPart, signaturePart] = parts;

        const header = JSON.parse(
            Buffer.from(headerPart, "base64url").toString()
        );

        const payload = JSON.parse(
            Buffer.from(payloadPart, "base64url").toString()
        );

        if (
            header.alg !== "EdDSA" ||
            !payload.sub ||
            payload.iss !== ISSUER ||
            !payload.exp ||
            payload.exp <= Math.floor(Date.now() / 1000) ||
            (payload.nbf && payload.nbf > Math.floor(Date.now() / 1000))
        ) {
            return res.status(401).json({
                success: false,
                message: "Invalid or expired token",
            });
        }

        const keys = await getPublicKeys();
        const jwk = keys.find((key) => key.kid === header.kid);

        if (!jwk) {
            return res.status(401).json({
                success: false,
                message: "Invalid token key",
            });
        }

        const publicKey = createPublicKey({
            key: jwk,
            format: "jwk",
        });

        const isValid = verify(
            null,
            Buffer.from(`${headerPart}.${payloadPart}`),
            publicKey,
            Buffer.from(signaturePart, "base64url")
        );

        if (!isValid) {
            return res.status(401).json({
                success: false,
                message: "Invalid token signature",
            });
        }

        req.user = {
            id: payload.sub,
            email: payload.email,
        };

        next();
    } catch (error) {
        console.error("JWT verification error:", error.message);

        return res.status(401).json({
            success: false,
            message: "Unauthorized: Invalid token",
        });
    }
}
