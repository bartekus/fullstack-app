import { api } from "encore.dev/api";
import { createRequestListener } from "@react-router/node";

// Your server build (Vite output). Exact import path depends on your build setup.
const buildPromise = import("./build/server/index.js");

const listenerPromise = (async () => {
    const build = await buildPromise;
    // createRequestListener expects a ServerBuild-based handler
    return createRequestListener({ build });
})();

export const web = api.raw(
    { expose: true, path: "/!rest", method: "*" },
    async (req, res) => {
        const listener = await listenerPromise;
        return listener(req, res);
    },
);
