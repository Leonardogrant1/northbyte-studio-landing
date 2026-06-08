import { httpAction } from "../_generated/server";
import { internal } from "../_generated/api";

export const clerkWebhook = httpAction(async (ctx, request) => {
  const svix_id = request.headers.get("svix-id");
  const svix_timestamp = request.headers.get("svix-timestamp");
  const svix_signature = request.headers.get("svix-signature");

  if (!svix_id || !svix_timestamp || !svix_signature) {
    console.error("Missing svix headers");
    return new Response("Missing svix headers", { status: 400 });
  }

  try {
    const body = await request.json();
    const eventType = body.type;

    console.log("Clerk webhook received:", eventType);

    if (eventType === "user.created") {
      const { id: clerkId, email_addresses } = body.data;
      const email: string | undefined = email_addresses?.[0]?.email_address;

      // Look up open invite to determine role
      let type: "admin" | "creator" | "affiliate" | "support" | undefined;
      if (email) {
        const invite = await ctx.runQuery(internal.user_invites.queries.getOpenInviteByEmailInternal, { email });
        if (invite) {
          type = invite.role;
        }
      }

      await ctx.runMutation(internal.users.mutations.createUser, {
        clerkId,
        email,
        type,
      });

      console.log("User created:", clerkId, "type:", type ?? "fallback");
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
