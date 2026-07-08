import { useQuery } from "convex/react";
import { api } from "@repo/backend/convex/_generated/api";

export const useCurrentUser = () => useQuery(api.users.queries.getCurrentUser);
