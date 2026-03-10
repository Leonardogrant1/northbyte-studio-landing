import { mutation } from "../_generated/server";
import { v } from "convex/values";

export const create = mutation({
    args: {
        description: v.string(),
        vendor_invoice_id: v.optional(v.string()),
        vendor_receipt_id: v.optional(v.string()),
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
        let existingExpense = null;

        if (args.vendor_invoice_id) {
            existingExpense = await ctx.db
                .query("expenses")
                .withIndex("by_vendor_invoice", (q) =>
                    q.eq("vendor_id", args.vendor_id).eq("vendor_invoice_id", args.vendor_invoice_id as string)
                )
                .first();
        }

        if (!existingExpense && args.vendor_receipt_id) {
            existingExpense = await ctx.db
                .query("expenses")
                .withIndex("by_vendor_receipt", (q) =>
                    q.eq("vendor_id", args.vendor_id).eq("vendor_receipt_id", args.vendor_receipt_id as string)
                )
                .first();
        }

        if (existingExpense) {
            // Deduplicate: if there are new URLs, append them
            if (args.urls && args.urls.length > 0) {
                const existingUrls = existingExpense.urls || [];
                const newUrls = args.urls.filter(url => !existingUrls.includes(url));
                
                if (newUrls.length > 0) {
                    await ctx.db.patch(existingExpense._id, {
                        urls: [...existingUrls, ...newUrls],
                    });
                }
            }
            return existingExpense._id;
        }

        return await ctx.db.insert("expenses", {
            description: args.description,
            vendor_invoice_id: args.vendor_invoice_id,
            vendor_receipt_id: args.vendor_receipt_id,
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
