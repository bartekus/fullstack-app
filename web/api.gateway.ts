import { api } from "encore.dev/api";
import { createRequestListener } from "@react-router/node";
import type { IncomingMessage } from "node:http";

// Your server build (Vite output). Exact import path depends on your build setup.
// @ts-ignore
const buildPromise = import("./build/server/index.js");

const listenerPromise = (async () => {
    const build = await buildPromise;
    return createRequestListener({ build });
})();

const DEFAULT_PUBLIC_HOST = "localhost:4002";

/**
 * Fix Origin and Host headers when Encore forwards requests with invalid/missing values.
 * React Router's CSRF check requires valid Origin URL and Host header.
 * Builds a clean headers array to avoid corrupting rawHeaders (which can cause
 * "invalid header name" errors when URLs end up as header names).
 */
function fixRequestHeaders(req: IncomingMessage) {
    const hostRaw = req.headers["host"] ?? req.headers["x-forwarded-host"];
    const host = Array.isArray(hostRaw) ? hostRaw[0] : hostRaw;
    let hostValue = host && typeof host === "string" ? host.split(",")[0].trim() : "";
    if (!hostValue || hostValue === "origin") {
        hostValue = process.env.ENCORE_PUBLIC_HOST ?? DEFAULT_PUBLIC_HOST;
    } else if (
        (hostValue === "127.0.0.1" || hostValue === "localhost") &&
        !hostValue.includes(":")
    ) {
        hostValue = process.env.ENCORE_PUBLIC_HOST ?? DEFAULT_PUBLIC_HOST;
    }

    const protocol = (req.socket as { encrypted?: boolean })?.encrypted ? "https:" : "http:";
    const validOrigin = `${protocol}//${hostValue}`;

    const raw = req.rawHeaders;
    if (!Array.isArray(raw)) return;

    const out: string[] = [];
    let originAdded = false;
    let hostAdded = false;

    for (let i = 0; i + 1 < raw.length; i += 2) {
        const name = raw[i];
        const value = raw[i + 1];
        const nameLower = name?.toLowerCase();

        if (nameLower === "origin") {
            const useValue =
                value && value !== "referer" && /^https?:\/\//.test(value)
                    ? value
                    : validOrigin;
            out.push("Origin", useValue);
            originAdded = true;
        } else if (nameLower === "host" || nameLower === "x-forwarded-host") {
            const useValue = value && value !== "origin" ? value : hostValue;
            out.push(name!, useValue);
            hostAdded = true;
        } else if (name && typeof name === "string" && !name.startsWith("http")) {
            out.push(name, value ?? "");
        }
    }

    if (!originAdded) out.push("Origin", validOrigin);
    if (!hostAdded) out.push("Host", hostValue);

    req.rawHeaders.length = 0;
    req.rawHeaders.push(...out);
}

// Serve all files in the ./assets directory under the /public path prefix.
export const assets = api.static({
    expose: true,
    path: "/assets/*path",
    dir: "./build/client/assets",
});

export const reactrouter = api.raw(
    { expose: true, path: "/!rest", method: "*" },
    async (req, res) => {
        // Chrome DevTools requests - return 404 without hitting React Router
        if (req.url?.startsWith("/.well-known/")) {
            res.writeHead(404);
            res.end();
            return;
        }
        fixRequestHeaders(req);
        const listener = await listenerPromise;
        return listener(req, res);
    },
);
