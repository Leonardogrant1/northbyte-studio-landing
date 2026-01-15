import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export const useCurrentUser = () => useQuery(api.users.queries.getCurrentUser);
