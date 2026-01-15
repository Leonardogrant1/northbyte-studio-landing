import { httpAction } from "../_generated/server";
import { internal } from "../_generated/api";

// Clerk Webhook for user.created events
// Documentation: https://clerk.com/docs/integrations/webhooks
export const clerkWebhook = httpAction(async (ctx, request) => {
  // Verify webhook signature (Svix headers)
  const svix_id = request.headers.get("svix-id");
  const svix_timestamp = request.headers.get("svix-timestamp");
  const svix_signature = request.headers.get("svix-signature");

  if (!svix_id || !svix_timestamp || !svix_signature) {
    console.error("Missing svix headers");
    return new Response("Missing svix headers", { status: 400 });
  }

  // In production, verify the signature using svix library
  // For now, we'll process the webhook directly

  try {
    const body = await request.json();
    const eventType = body.type;

    console.log("Clerk webhook received:", eventType);

    if (eventType === "user.created") {
      const { id: clerkId, email_addresses } = body.data;
      const email = email_addresses?.[0]?.email_address;

      await ctx.runMutation(internal.users.mutations.createUser, {
        clerkId,
        email,
      });

      console.log("User created:", clerkId);
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Clerk webhook error:", error);
    return new Response(
      error instanceof Error ? error.message : "Internal Server Error",
      { status: 500 }
    );
  }
});
