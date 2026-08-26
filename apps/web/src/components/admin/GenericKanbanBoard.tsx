"use client";

import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  Modifier,
  pointerWithin,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import React, { useEffect, useMemo, useState } from "react";
import { Expand, X } from "lucide-react";
import { KanbanColumn } from "@/lib/kanban-config";

// Base interface for kanban items
export interface KanbanItem {
  _id: string;
  title: string;
  description: string;
  upvotes: number;
  status: string;
  _creationTime?: number;
}

interface GenericKanbanBoardProps<TItem extends KanbanItem> {
  items: TItem[];
  columns: readonly KanbanColumn[];
  onStatusChange: (itemId: string, newStatus: string) => void;
  renderCardContent?: (item: TItem) => React.ReactNode;
  renderDetailContent?: (item: TItem) => React.ReactNode;
}

function DefaultCardContent<TItem extends KanbanItem>({ item }: { item: TItem }) {
  const dateStr = item._creationTime
    ? new Date(item._creationTime).toLocaleDateString(undefined, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : null;

  return (
    <>
      <h3 className="font-semibold text-primary mb-2">{item.title}</h3>
      <p className="text-sm text-secondary line-clamp-2 mb-3">
        {item.description}
      </p>
      <div className="flex items-center justify-between text-xs text-secondary">
        <span>
          {item.upvotes} {item.upvotes === 1 ? "Upvote" : "Upvotes"}
        </span>
        {dateStr && <span>{dateStr}</span>}
      </div>
    </>
  );
}

function ItemCard<TItem extends KanbanItem>({
  item,
  isOverlay = false,
  renderCardContent,
  onExpand,
}: {
  item: TItem;
  isOverlay?: boolean;
  renderCardContent?: (item: TItem) => React.ReactNode;
  onExpand?: (item: TItem) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item._id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const content = renderCardContent ? (
    renderCardContent(item)
  ) : (
    <DefaultCardContent item={item} />
  );

  // For overlay, we render a "static" card without sortable behavior
  if (isOverlay) {
    return (
      <div className="bg-surface2/90 backdrop-blur-xl border border-accent rounded-xl p-4 shadow-2xl">
        {content}
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="group relative bg-surface2/50 backdrop-blur-xl border border-border rounded-xl p-4 mb-3 cursor-grab active:cursor-grabbing hover:border-accent/50 transition-all"
    >
      {onExpand && (
        <button
          // stopPropagation on pointerdown keeps the click from activating the dnd-kit drag sensor
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onExpand(item)}
          aria-label="Details öffnen"
          className="absolute top-2 right-2 p-1.5 rounded-lg text-secondary bg-surface/80 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-primary hover:bg-surface2 transition-all"
        >
          <Expand size={14} />
        </button>
      )}
      {content}
    </div>
  );
}

function KanbanDetailDialog<TItem extends KanbanItem>({
  item,
  columns,
  onClose,
  renderDetailContent,
}: {
  item: TItem;
  columns: readonly KanbanColumn[];
  onClose: () => void;
  renderDetailContent?: (item: TItem) => React.ReactNode;
}) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const column = columns.find((col) => col.id === item.status);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-surface rounded-2xl border border-border shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-6 py-5 border-b border-border sticky top-0 bg-surface z-10">
          <h2 className="text-lg font-bold text-primary">{item.title}</h2>
          <button
            onClick={onClose}
            aria-label="Schließen"
            className="p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-surface2 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-6 space-y-4">
          {column && (
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full border text-xs font-semibold ${column.color}`}
            >
              {column.title}
            </span>
          )}

          {renderDetailContent ? (
            renderDetailContent(item)
          ) : (
            <>
              <p className="text-sm text-secondary whitespace-pre-wrap">
                {item.description || "Keine Beschreibung vorhanden."}
              </p>
              <div className="flex justify-between items-center pt-4 text-xs text-secondary border-t border-border/50">
                <span>
                  {item.upvotes} {item.upvotes === 1 ? "Upvote" : "Upvotes"}
                </span>
                {item._creationTime && (
                  <span>
                    Erstellt am:{" "}
                    {new Date(item._creationTime).toLocaleString(undefined, {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Column<TItem extends KanbanItem>({
  column,
  items,
  renderCardContent,
  onExpand,
}: {
  column: KanbanColumn;
  items: TItem[];
  renderCardContent?: (item: TItem) => React.ReactNode;
  onExpand?: (item: TItem) => void;
}) {
  const itemsInColumn = useMemo(
    () => items.filter((item) => item.status === column.id),
    [items, column.id]
  );

  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  });

  return (
    <div className="flex-1 min-w-[300px]">
      <div className="mb-4">
        <div
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border ${column.color}`}
        >
          <span className="text-sm font-semibold">{column.title}</span>
          <span className="text-xs bg-background/50 px-2 py-0.5 rounded-full">
            {itemsInColumn.length}
          </span>
        </div>
      </div>

      <div
        ref={setNodeRef}
        className={`space-y-3 min-h-[200px] p-2 rounded-lg transition-colors ${
          isOver ? "bg-accent/10 border-2 border-dashed border-accent" : ""
        }`}
      >
        <SortableContext
          items={itemsInColumn.map((item) => item._id)}
          strategy={verticalListSortingStrategy}
        >
          {itemsInColumn.map((item) => (
            <ItemCard
              key={item._id}
              item={item}
              renderCardContent={renderCardContent}
              onExpand={onExpand}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}

// Custom modifier to snap the dragged element to cursor position
const snapToCursor: Modifier = ({ activatorEvent, draggingNodeRect, transform }) => {
  if (activatorEvent instanceof PointerEvent && draggingNodeRect) {
    const offsetX = activatorEvent.clientX - draggingNodeRect.left - draggingNodeRect.width / 2;
    const offsetY = activatorEvent.clientY - draggingNodeRect.top - draggingNodeRect.height / 2;

    return {
      ...transform,
      x: transform.x + offsetX,
      y: transform.y + offsetY,
    };
  }
  return transform;
};

export function GenericKanbanBoard<TItem extends KanbanItem>({
  items,
  columns,
  onStatusChange,
  renderCardContent,
  renderDetailContent,
}: GenericKanbanBoardProps<TItem>) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detailItemId, setDetailItemId] = useState<string | null>(null);

  // Resolve from items so the dialog reflects live updates and closes if the item is deleted
  const detailItem = detailItemId
    ? items.find((item) => item._id === detailItemId) ?? null
    : null;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    setActiveId(null);

    if (!over) return;

    const itemId = active.id as string;
    const overId = over.id;

    // Dropped on a column (status)
    if (columns.some((col) => col.id === overId)) {
      const item = items.find((i) => i._id === itemId);
      if (item && item.status !== overId) {
        onStatusChange(itemId, overId as string);
      }
      return;
    }

    // Dropped on another item -> adopt that item's column
    const targetItem = items.find((i) => i._id === overId);
    if (targetItem) {
      const item = items.find((i) => i._id === itemId);
      if (item && item.status !== targetItem.status) {
        onStatusChange(itemId, targetItem.status);
      }
    }
  };

  const activeItem = activeId ? items.find((item) => item._id === activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-6 overflow-x-auto pb-4">
        {columns.map((column) => (
          <Column
            key={column.id}
            column={column}
            items={items}
            renderCardContent={renderCardContent}
            onExpand={(item) => setDetailItemId(item._id)}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={null} modifiers={[snapToCursor]}>
        {activeItem ? (
          <ItemCard item={activeItem} isOverlay renderCardContent={renderCardContent} />
        ) : null}
      </DragOverlay>

      {detailItem && (
        <KanbanDetailDialog
          item={detailItem}
          columns={columns}
          onClose={() => setDetailItemId(null)}
          renderDetailContent={renderDetailContent}
        />
      )}
    </DndContext>
  );
}
