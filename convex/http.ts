import { httpRouter } from "convex/server";
import { clerkWebhook } from "./users/webhooks";

const http = httpRouter();

// Clerk Webhook (user.created)
http.route({
    path: "/webhooks/clerk",
    method: "POST",
    handler: clerkWebhook,
});

export default http;
