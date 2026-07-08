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
import React, { useMemo, useState } from "react";
import { KanbanColumn } from "@/lib/kanban-config";

// Base interface for kanban items
export interface KanbanItem {
  _id: string;
  title: string;
  description: string;
  upvotes: number;
  status: string;
}

interface GenericKanbanBoardProps<TItem extends KanbanItem> {
  items: TItem[];
  columns: readonly KanbanColumn[];
  onStatusChange: (itemId: string, newStatus: string) => void;
  renderCardContent?: (item: TItem) => React.ReactNode;
}

function DefaultCardContent<TItem extends KanbanItem>({ item }: { item: TItem }) {
  return (
    <>
      <h3 className="font-semibold text-primary mb-2">{item.title}</h3>
      <p className="text-sm text-secondary line-clamp-2 mb-3">
        {item.description}
      </p>
      <div className="flex items-center justify-between">
        <span className="text-xs text-secondary">
          {item.upvotes} {item.upvotes === 1 ? "Upvote" : "Upvotes"}
        </span>
      </div>
    </>
  );
}

function ItemCard<TItem extends KanbanItem>({
  item,
  isOverlay = false,
  renderCardContent,
}: {
  item: TItem;
  isOverlay?: boolean;
  renderCardContent?: (item: TItem) => React.ReactNode;
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
      className="bg-surface2/50 backdrop-blur-xl border border-border rounded-xl p-4 mb-3 cursor-grab active:cursor-grabbing hover:border-accent/50 transition-all"
    >
      {content}
    </div>
  );
}

function Column<TItem extends KanbanItem>({
  column,
  items,
  renderCardContent,
}: {
  column: KanbanColumn;
  items: TItem[];
  renderCardContent?: (item: TItem) => React.ReactNode;
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
}: GenericKanbanBoardProps<TItem>) {
  const [activeId, setActiveId] = useState<string | null>(null);

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
          />
        ))}
      </div>

      <DragOverlay dropAnimation={null} modifiers={[snapToCursor]}>
        {activeItem ? (
          <ItemCard item={activeItem} isOverlay renderCardContent={renderCardContent} />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
