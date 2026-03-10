import { query } from "../_generated/server";
import { v } from "convex/values";

export const getAll = query({
    args: {},
    handler: async (ctx) => {
        return await ctx.db.query("expenses").collect();
    },
});

export const getByDateRange = query({
    args: {
        startDate: v.string(),
        endDate: v.string(),
    },
    handler: async (ctx, { startDate, endDate }) => {
        const expenses = await ctx.db.query("expenses").collect();
        const filtered = expenses.filter((e) => {
            const d = e.date.slice(0, 10);
            return d >= startDate && d <= endDate;
        });

        return await Promise.all(
            filtered.map(async (expense) => {
                const vendor = await ctx.db.get(expense.vendor_id);
                const category = await ctx.db.get(expense.category_id);
                return {
                    ...expense,
                    vendorName: vendor?.name ?? "Unknown",
                    categoryName: category?.name ?? "Unknown",
                };
            })
        );
    },
});
