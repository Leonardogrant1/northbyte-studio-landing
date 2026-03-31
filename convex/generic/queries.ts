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
    args: { table: v.string(), field: v.string(), value: v.optional(v.any()), exists: v.optional(v.boolean()) },
    handler: async (ctx, args) => {
        const records = await ctx.db.query(args.table as TableNames).collect();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return records.filter((r: any) => {
            if (args.exists !== undefined) {
                const fieldExists = r[args.field] !== undefined && r[args.field] !== null;
                return args.exists ? fieldExists : !fieldExists;
            }
            return r[args.field] === args.value;
        });
    },
});

// Each condition: { field, value } for equality or { field, exists: true/false } for null-check
export const findByFilters = query({
    args: {
        table: v.string(),
        conditions: v.array(
            v.union(
                v.object({ field: v.string(), value: v.any() }),
                v.object({ field: v.string(), exists: v.boolean() }),
            )
        ),
    },
    handler: async (ctx, args) => {
        const records = await ctx.db.query(args.table as TableNames).collect();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return records.filter((r: any) =>
            args.conditions.every((condition) => {
                if ("exists" in condition) {
                    const fieldExists = r[condition.field] !== undefined && r[condition.field] !== null;
                    return condition.exists ? fieldExists : !fieldExists;
                }
                return r[condition.field] === condition.value;
            })
        );
    },
});
