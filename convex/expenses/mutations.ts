import { mutation } from "../_generated/server";
import { v } from "convex/values";

export const create = mutation({
    args: {
        description: v.string(),
        source_invoice_id: v.string(),
        source_id: v.id("sources"),
        category_id: v.id("categories"),
        original_amount: v.number(),
        original_currency: v.string(),
        amount_usd: v.number(),
        tax_amount: v.optional(v.number()),
        date: v.string(),
    },
    handler: async (ctx, args) => {
        return await ctx.db.insert("expenses", {
            description: args.description,
            source_invoice_id: args.source_invoice_id,
            source_id: args.source_id,
            category_id: args.category_id,
            original_amount: args.original_amount,
            original_currency: args.original_currency,
            amount_usd: args.amount_usd,
            tax_amount: args.tax_amount,
            date: args.date,
        });
    },
});
