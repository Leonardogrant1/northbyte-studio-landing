export interface KanbanColumn {
  id: string;
  title: string;
  color: string; // CSS classes
}

export const BUG_COLUMNS: readonly KanbanColumn[] = [
  {
    id: "open",
    title: "Open",
    color: "bg-red-500/10 text-red-400 border-red-500/20",
  },
  {
    id: "in-progress",
    title: "In Progress",
    color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  },
  {
    id: "resolved",
    title: "Resolved",
    color: "bg-green-500/10 text-green-400 border-green-500/20",
  },
] as const;

export const FEATURE_COLUMNS: readonly KanbanColumn[] = [
  {
    id: "planned",
    title: "Planned",
    color: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  },
  {
    id: "in-development",
    title: "In Development",
    color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  },
  {
    id: "completed",
    title: "Completed",
    color: "bg-green-500/10 text-green-400 border-green-500/20",
  },
] as const;

export const CREATOR_APPLICATION_COLUMNS: readonly KanbanColumn[] = [
  {
    id: "pending",
    title: "Pending",
    color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  },
  {
    id: "contacted",
    title: "Contacted",
    color: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  },
  {
    id: "rejected",
    title: "Rejected",
    color: "bg-red-500/10 text-red-400 border-red-500/20",
  },
] as const;
