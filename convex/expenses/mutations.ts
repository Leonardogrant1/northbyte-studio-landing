import { mutation } from "../_generated/server";
import { v } from "convex/values";

export const create = mutation({
    args: {
        description: v.string(),
        vendor_invoice_id: v.string(),
        vendor_id: v.id("vendors"),
        category_id: v.id("categories"),
        original_amount: v.number(),
        original_currency: v.string(),
        amount_usd: v.number(),
        tax_amount: v.optional(v.number()),
        date: v.string(),
        urls: v.optional(v.array(v.string())),
    },
    handler: async (ctx, args) => {
        return await ctx.db.insert("expenses", {
            description: args.description,
            vendor_invoice_id: args.vendor_invoice_id,
            vendor_id: args.vendor_id,
            category_id: args.category_id,
            original_amount: args.original_amount,
            original_currency: args.original_currency,
            amount_usd: args.amount_usd,
            tax_amount: args.tax_amount,
            date: args.date,
            urls: args.urls,
        });
    },
});
