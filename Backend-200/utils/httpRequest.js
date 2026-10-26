const http = require("http");
const https = require("https");

// Supports the text responses used by Taxilla without requiring global fetch.
const httpRequest = async (url, options = {}, redirectCount = 0) => {
    const endpoint = new URL(url);
    if (!["http:", "https:"].includes(endpoint.protocol)) {
        throw new Error(`Unsupported request protocol: ${endpoint.protocol}`);
    }

    const method = (options.method || "GET").toUpperCase();
    const headers = Object.fromEntries(
        Object.entries(options.headers || {})
            .filter(([, value]) => value !== undefined && value !== null)
            .map(([name, value]) => [name.toLowerCase(), value])
    );
    const body = options.body === undefined || options.body === null
        ? undefined
        : Buffer.isBuffer(options.body)
            ? options.body
            : Buffer.from(String(options.body), "utf8");

    if (body !== undefined) {
        headers["content-length"] = body.length;
    }

    const transport = endpoint.protocol === "https:" ? https : http;

    return new Promise((resolve, reject) => {
        const rejectRequest = (error) => reject(new Error(error.message, { cause: error }));
        const request = transport.request(endpoint, { method, headers }, async (response) => {
            try {
                const chunks = [];
                for await (const chunk of response) {
                    chunks.push(chunk);
                }

                const status = response.statusCode;
                if ([301, 302, 303, 307, 308].includes(status) && response.headers.location) {
                    if (redirectCount >= 20) {
                        throw new Error("Too many HTTP redirects");
                    }

                    const redirectUrl = new URL(response.headers.location, endpoint);
                    const redirectHeaders = { ...headers };
                    let redirectMethod = method;
                    let redirectBody = body;

                    if (redirectUrl.origin !== endpoint.origin) {
                        delete redirectHeaders.authorization;
                        delete redirectHeaders.cookie;
                    }

                    if (
                        ([301, 302].includes(status) && method === "POST") ||
                        (status === 303 && !["GET", "HEAD"].includes(method))
                    ) {
                        redirectMethod = "GET";
                        redirectBody = undefined;
                        delete redirectHeaders["content-length"];
                        delete redirectHeaders["content-type"];
                        delete redirectHeaders["transfer-encoding"];
                    }

                    resolve(httpRequest(redirectUrl, {
                        method: redirectMethod,
                        headers: redirectHeaders,
                        body: redirectBody
                    }, redirectCount + 1));
                    return;
                }

                const text = Buffer.concat(chunks).toString("utf8");
                resolve({
                    ok: status >= 200 && status < 300,
                    status,
                    statusText: response.statusMessage || "",
                    text: async () => text
                });
            } catch (error) {
                rejectRequest(error);
            }
        });

        request.on("error", rejectRequest);
        request.end(body);
    });
};

module.exports = httpRequest;
