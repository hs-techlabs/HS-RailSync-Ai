/**
 * Cloudflare Pages Function: API Edge Reverse Proxy
 *
 * Automatically intercepts all requests to /api/* and proxies them to the AWS backend.
 * Solves two major web deployment problems out-of-the-box:
 * 1. Zero Mixed Content: Cloudflare Pages serves over HTTPS, proxying to HTTP on AWS EC2.
 * 2. Zero CORS Issues: The browser communicates only with your Pages domain.
 *
 * Configure your AWS backend URL in Cloudflare Pages Dashboard:
 * Settings -> Environment variables -> Add variable:
 * BACKEND_URL = http://<YOUR_AWS_EC2_PUBLIC_IP>:8000
 */

export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);

    // Get backend base URL from Cloudflare environment variable or fallback
    const backendBase = env.BACKEND_URL || "http://127.0.0.1:8000";
    const cleanBackend = backendBase.replace(/\/+$/, "");

    // Build target destination URL
    const targetUrl = `${cleanBackend}${url.pathname}${url.search}`;

    try {
        const clientHeaders = new Headers(request.headers);
        // Ensure the host header points to the target if needed
        clientHeaders.set("X-Forwarded-Host", url.host);
        clientHeaders.set("X-Forwarded-Proto", url.protocol.replace(":", ""));

        const proxyResponse = await fetch(targetUrl, {
            method: request.method,
            headers: clientHeaders,
            body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
            redirect: "follow"
        });

        // Copy response headers and ensure CORS is friendly
        const responseHeaders = new Headers(proxyResponse.headers);
        responseHeaders.set("Access-Control-Allow-Origin", "*");
        responseHeaders.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        responseHeaders.set("Access-Control-Allow-Headers", "*");

        return new Response(proxyResponse.body, {
            status: proxyResponse.status,
            statusText: proxyResponse.statusText,
            headers: responseHeaders
        });
    } catch (err) {
        return new Response(
            JSON.stringify({
                error: "Failed to connect to AWS Backend",
                details: err.message,
                hint: "Ensure BACKEND_URL is set in Cloudflare Pages Environment Variables and EC2 Security Group allows port 8000/80."
            }),
            {
                status: 502,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                }
            }
        );
    }
}
