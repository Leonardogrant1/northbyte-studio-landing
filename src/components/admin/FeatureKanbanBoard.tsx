"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/../convex/_generated/api";
import { Id } from "@/../convex/_generated/dataModel";
import { GenericKanbanBoard, KanbanItem } from "./GenericKanbanBoard";
import { FEATURE_COLUMNS } from "@/lib/kanban-config";

interface Feature extends KanbanItem {
  _id: Id<"features">;
  _creationTime: number;
  appId: Id<"apps">;
}

interface FeatureKanbanBoardProps {
  appId: Id<"apps">;
}

export function FeatureKanbanBoard({ appId }: FeatureKanbanBoardProps) {
  const features = useQuery(api.features.queries.getByApp, { appId }) || [];
  const updateFeature = useMutation(api.features.mutations.update);

  const handleStatusChange = (featureId: string, newStatus: string) => {
    updateFeature({ featureId: featureId as Id<"features">, status: newStatus });
  };

  return (
    <GenericKanbanBoard<Feature>
      items={features as Feature[]}
      columns={FEATURE_COLUMNS}
      onStatusChange={handleStatusChange}
    />
  );
}
