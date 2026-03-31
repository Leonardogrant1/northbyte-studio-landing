import { query } from "../_generated/server";
import { v } from "convex/values";
import { TableNames } from "../_generated/dataModel";

export const getAll = query({
    args: { table: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db.query(args.table as TableNames).collect();
    },
});

export const getById = query({
    args: { id: v.string() },
    handler: async (ctx, args) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return await ctx.db.get(args.id as any);
    },
});

export const findByField = query({
    args: { table: v.string(), field: v.string(), value: v.any() },
    handler: async (ctx, args) => {
        const records = await ctx.db.query(args.table as TableNames).collect();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return records.filter((r: any) => r[args.field] === args.value);
    },
});
