/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as affiliate_profiles_mutations from "../affiliate_profiles/mutations.js";
import type * as affiliate_profiles_queries from "../affiliate_profiles/queries.js";
import type * as affiliate_profiles_stats from "../affiliate_profiles/stats.js";
import type * as affiliate_referral_mutations from "../affiliate_referral/mutations.js";
import type * as ai_avatars_mutations from "../ai_avatars/mutations.js";
import type * as ai_avatars_queries from "../ai_avatars/queries.js";
import type * as apps_mutations from "../apps/mutations.js";
import type * as apps_queries from "../apps/queries.js";
import type * as bugs_actions from "../bugs/actions.js";
import type * as bugs_mutations from "../bugs/mutations.js";
import type * as bugs_queries from "../bugs/queries.js";
import type * as categories_mutations from "../categories/mutations.js";
import type * as categories_queries from "../categories/queries.js";
import type * as creator_application_actions from "../creator_application/actions.js";
import type * as creator_application_mutations from "../creator_application/mutations.js";
import type * as creator_application_queries from "../creator_application/queries.js";
import type * as expenses_mutations from "../expenses/mutations.js";
import type * as expenses_queries from "../expenses/queries.js";
import type * as features_actions from "../features/actions.js";
import type * as features_mutations from "../features/mutations.js";
import type * as features_queries from "../features/queries.js";
import type * as generic_mutations from "../generic/mutations.js";
import type * as generic_queries from "../generic/queries.js";
import type * as http from "../http.js";
import type * as kling_tasks_mutations from "../kling_tasks/mutations.js";
import type * as kling_tasks_queries from "../kling_tasks/queries.js";
import type * as media_mutations from "../media/mutations.js";
import type * as media_queries from "../media/queries.js";
import type * as posts_mutations from "../posts/mutations.js";
import type * as posts_queries from "../posts/queries.js";
import type * as social_accounts_mutations from "../social_accounts/mutations.js";
import type * as social_accounts_queries from "../social_accounts/queries.js";
import type * as storage_actions from "../storage/actions.js";
import type * as storage_mutations from "../storage/mutations.js";
import type * as storage_queries from "../storage/queries.js";
import type * as ticket_messages_actions from "../ticket_messages/actions.js";
import type * as ticket_messages_mutations from "../ticket_messages/mutations.js";
import type * as ticket_messages_queries from "../ticket_messages/queries.js";
import type * as tickets__helpers from "../tickets/_helpers.js";
import type * as tickets_mutations from "../tickets/mutations.js";
import type * as tickets_queries from "../tickets/queries.js";
import type * as user_app_assignments_mutations from "../user_app_assignments/mutations.js";
import type * as user_app_assignments_queries from "../user_app_assignments/queries.js";
import type * as user_attachments_mutations from "../user_attachments/mutations.js";
import type * as user_attachments_queries from "../user_attachments/queries.js";
import type * as user_invites_actions from "../user_invites/actions.js";
import type * as user_invites_mutations from "../user_invites/mutations.js";
import type * as user_invites_queries from "../user_invites/queries.js";
import type * as users_mutations from "../users/mutations.js";
import type * as users_queries from "../users/queries.js";
import type * as users_webhooks from "../users/webhooks.js";
import type * as vendors_mutations from "../vendors/mutations.js";
import type * as vendors_queries from "../vendors/queries.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "affiliate_profiles/mutations": typeof affiliate_profiles_mutations;
  "affiliate_profiles/queries": typeof affiliate_profiles_queries;
  "affiliate_profiles/stats": typeof affiliate_profiles_stats;
  "affiliate_referral/mutations": typeof affiliate_referral_mutations;
  "ai_avatars/mutations": typeof ai_avatars_mutations;
  "ai_avatars/queries": typeof ai_avatars_queries;
  "apps/mutations": typeof apps_mutations;
  "apps/queries": typeof apps_queries;
  "bugs/actions": typeof bugs_actions;
  "bugs/mutations": typeof bugs_mutations;
  "bugs/queries": typeof bugs_queries;
  "categories/mutations": typeof categories_mutations;
  "categories/queries": typeof categories_queries;
  "creator_application/actions": typeof creator_application_actions;
  "creator_application/mutations": typeof creator_application_mutations;
  "creator_application/queries": typeof creator_application_queries;
  "expenses/mutations": typeof expenses_mutations;
  "expenses/queries": typeof expenses_queries;
  "features/actions": typeof features_actions;
  "features/mutations": typeof features_mutations;
  "features/queries": typeof features_queries;
  "generic/mutations": typeof generic_mutations;
  "generic/queries": typeof generic_queries;
  http: typeof http;
  "kling_tasks/mutations": typeof kling_tasks_mutations;
  "kling_tasks/queries": typeof kling_tasks_queries;
  "media/mutations": typeof media_mutations;
  "media/queries": typeof media_queries;
  "posts/mutations": typeof posts_mutations;
  "posts/queries": typeof posts_queries;
  "social_accounts/mutations": typeof social_accounts_mutations;
  "social_accounts/queries": typeof social_accounts_queries;
  "storage/actions": typeof storage_actions;
  "storage/mutations": typeof storage_mutations;
  "storage/queries": typeof storage_queries;
  "ticket_messages/actions": typeof ticket_messages_actions;
  "ticket_messages/mutations": typeof ticket_messages_mutations;
  "ticket_messages/queries": typeof ticket_messages_queries;
  "tickets/_helpers": typeof tickets__helpers;
  "tickets/mutations": typeof tickets_mutations;
  "tickets/queries": typeof tickets_queries;
  "user_app_assignments/mutations": typeof user_app_assignments_mutations;
  "user_app_assignments/queries": typeof user_app_assignments_queries;
  "user_attachments/mutations": typeof user_attachments_mutations;
  "user_attachments/queries": typeof user_attachments_queries;
  "user_invites/actions": typeof user_invites_actions;
  "user_invites/mutations": typeof user_invites_mutations;
  "user_invites/queries": typeof user_invites_queries;
  "users/mutations": typeof users_mutations;
  "users/queries": typeof users_queries;
  "users/webhooks": typeof users_webhooks;
  "vendors/mutations": typeof vendors_mutations;
  "vendors/queries": typeof vendors_queries;
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
