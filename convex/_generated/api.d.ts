/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as apps_mutations from "../apps/mutations.js";
import type * as apps_queries from "../apps/queries.js";
import type * as bugs_actions from "../bugs/actions.js";
import type * as bugs_mutations from "../bugs/mutations.js";
import type * as bugs_queries from "../bugs/queries.js";
import type * as features_actions from "../features/actions.js";
import type * as features_mutations from "../features/mutations.js";
import type * as features_queries from "../features/queries.js";
import type * as http from "../http.js";
import type * as users_mutations from "../users/mutations.js";
import type * as users_queries from "../users/queries.js";
import type * as users_webhooks from "../users/webhooks.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "apps/mutations": typeof apps_mutations;
  "apps/queries": typeof apps_queries;
  "bugs/actions": typeof bugs_actions;
  "bugs/mutations": typeof bugs_mutations;
  "bugs/queries": typeof bugs_queries;
  "features/actions": typeof features_actions;
  "features/mutations": typeof features_mutations;
  "features/queries": typeof features_queries;
  http: typeof http;
  "users/mutations": typeof users_mutations;
  "users/queries": typeof users_queries;
  "users/webhooks": typeof users_webhooks;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
