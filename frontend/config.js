/**
 * Indian Railways AI Automatic Block Planning System
 * Frontend Runtime Configuration
 *
 * When deployed on Cloudflare Pages:
 * - By default, API_BASE is empty (""), which routes through Cloudflare Pages Functions
 *   reverse-proxy (/api/* -> AWS Backend) to avoid CORS and HTTPS mixed-content blocks.
 * - Alternatively, set window.API_BASE to your full AWS Backend URL:
 *   e.g. window.API_BASE = "https://api.yourdomain.com"; or "http://<EC2-IP>:8000";
 */

(function () {
    // 1. Check if already configured via window or localStorage
    const savedBackend = typeof localStorage !== "undefined" ? localStorage.getItem("IR_BACKEND_URL") : null;
    const globalBackend = window.ENV_API_BASE || window.API_BASE || savedBackend;

    window.API_BASE = globalBackend || "";

    // Helper to dynamically switch backend URL in browser console for testing:
    // e.g. setBackendUrl("http://3.110.12.34:8000")
    window.setBackendUrl = function (url) {
        if (url) {
            const cleanUrl = url.replace(/\/+$/, "");
            localStorage.setItem("IR_BACKEND_URL", cleanUrl);
            window.API_BASE = cleanUrl;
            console.log("[Config] Backend URL set to:", cleanUrl);
        } else {
            localStorage.removeItem("IR_BACKEND_URL");
            window.API_BASE = "";
            console.log("[Config] Reset Backend URL to default (relative / proxy)");
        }
        window.location.reload();
    };

    console.log("[Config] IR Automatic Block Planner initialized. API_BASE:", window.API_BASE || "(proxy/relative)");
})();
