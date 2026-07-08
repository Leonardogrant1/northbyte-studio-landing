import { mutation } from "../_generated/server";
import { v } from "convex/values";

export const create = mutation({
    args: {
        taskId: v.string(),
        prompt: v.string(),
        imageUrl: v.string(),
        videoUrl: v.string(),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Unauthenticated");

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject))
            .first();
        if (!user) throw new Error("User not found.");

        return await ctx.db.insert("kling_tasks", {
            ...args,
            status: "submitted",
            createdBy: user._id,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        });
    },
});

export const updateStatus = mutation({
    args: {
        taskId: v.string(),
        status: v.union(
            v.literal("submitted"),
            v.literal("processing"),
            v.literal("succeed"),
            v.literal("failed")
        ),
        resultUrl: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Unauthenticated");

        const task = await ctx.db
            .query("kling_tasks")
            .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
            .first();
        if (!task) throw new Error("Task not found.");

        await ctx.db.patch(task._id, {
            status: args.status,
            resultUrl: args.resultUrl,
            updatedAt: Date.now(),
        });
    },
});
