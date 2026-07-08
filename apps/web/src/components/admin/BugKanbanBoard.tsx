"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@repo/backend/convex/_generated/api";
import { Id } from "@repo/backend/convex/_generated/dataModel";
import { GenericKanbanBoard, KanbanItem } from "./GenericKanbanBoard";
import { BUG_COLUMNS } from "@/lib/kanban-config";

interface Bug extends KanbanItem {
  _id: Id<"bugs">;
  _creationTime: number;
  appId: Id<"apps">;
}

interface BugKanbanBoardProps {
  appId: Id<"apps">;
}

export function BugKanbanBoard({ appId }: BugKanbanBoardProps) {
  const bugs = useQuery(api.bugs.queries.getByApp, { appId }) || [];
  const updateBug = useMutation(api.bugs.mutations.update);

  const handleStatusChange = (bugId: string, newStatus: string) => {
    updateBug({ bugId: bugId as Id<"bugs">, status: newStatus });
  };

  return (
    <GenericKanbanBoard<Bug>
      items={bugs as Bug[]}
      columns={BUG_COLUMNS}
      onStatusChange={handleStatusChange}
    />
  );
}
