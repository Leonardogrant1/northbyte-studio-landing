"use client";

import { useRef, useState, DragEvent } from "react";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, Upload, X } from "lucide-react";

interface MediaDropzoneProps {
  files: File[];
  previews: string[];
  onAdd: (files: File[]) => void;
  onRemove: (index: number) => void;
  onReorder: (files: File[], previews: string[]) => void;
  disabled?: boolean;
}

function SortableThumb({
  id,
  preview,
  file,
  onRemove,
  disabled,
}: {
  id: string;
  preview: string;
  file: File;
  onRemove: () => void;
  disabled?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="relative flex-shrink-0 w-20 h-32 rounded-lg overflow-hidden border border-border bg-surface2 cursor-grab active:cursor-grabbing touch-none"
    >
      {file.type.startsWith("video/") ? (
        <video src={preview} className="w-full h-full object-cover" muted />
      ) : (
        <img src={preview} alt="" className="w-full h-full object-cover" />
      )}
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        disabled={disabled}
        className="absolute top-1 right-1 p-0.5 rounded-full bg-black/60 hover:bg-black/80 transition-colors disabled:opacity-50"
      >
        <X size={12} className="text-white" />
      </button>
    </div>
  );
}

export function MediaDropzone({
  files,
  previews,
  onAdd,
  onRemove,
  onReorder,
  disabled,
}: MediaDropzoneProps) {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const ids = files.map((_, i) => String(i));
  const activeIndex = activeId != null ? Number(activeId) : null;

  const handleFileDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (disabled) return;
    const dropped = Array.from(e.dataTransfer.files).filter(
      (f) => f.type.startsWith("video/") || f.type.startsWith("image/")
    );
    if (dropped.length > 0) onAdd(dropped);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = Number(active.id);
    const newIndex = Number(over.id);
    onReorder(
      arrayMove(files, oldIndex, newIndex),
      arrayMove(previews, oldIndex, newIndex)
    );
  };

  const openPicker = () => {
    if (disabled) return;
    fileInputRef.current?.click();
  };
  const isEmpty = files.length === 0;

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,image/*"
        multiple
        onChange={(e) => {
          if (e.target.files) onAdd(Array.from(e.target.files));
          e.target.value = "";
        }}
        className="hidden"
      />

      {isEmpty ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDraggingOver(true);
          }}
          onDragLeave={() => setIsDraggingOver(false)}
          onDrop={handleFileDrop}
          onClick={openPicker}
          className={`w-full h-40 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors ${
            isDraggingOver
              ? "border-accent bg-accent/5"
              : "border-border hover:border-accent/50 hover:bg-surface2/50"
          }`}
        >
          <Upload size={22} className="text-secondary" />
          <p className="text-sm text-secondary">Dateien ablegen oder klicken</p>
          <p className="text-xs text-secondary/60">Video &amp; Bilder</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDraggingOver(true);
            }}
            onDragLeave={() => setIsDraggingOver(false)}
            onDrop={handleFileDrop}
            onClick={openPicker}
            className={`w-full h-10 rounded-lg border-2 border-dashed flex items-center justify-center gap-2 cursor-pointer transition-colors ${
              isDraggingOver
                ? "border-accent bg-accent/5"
                : "border-border hover:border-accent/50 hover:bg-surface2/50"
            }`}
          >
            <Plus size={14} className="text-secondary" />
            <span className="text-xs text-secondary">Weitere hinzufügen</span>
          </div>

          <DndContext
            sensors={sensors}
            onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setActiveId(null)}
          >
            <SortableContext items={ids} strategy={rectSortingStrategy}>
              <div className="flex flex-wrap gap-2">
                {files.map((file, i) => (
                  <SortableThumb
                    key={i}
                    id={String(i)}
                    preview={previews[i]}
                    file={file}
                    onRemove={() => onRemove(i)}
                    disabled={disabled}
                  />
                ))}
              </div>
            </SortableContext>

            <DragOverlay>
              {activeIndex != null && (
                <div className="w-20 h-32 rounded-lg overflow-hidden border border-accent opacity-90 shadow-xl">
                  {files[activeIndex].type.startsWith("video/") ? (
                    <video
                      src={previews[activeIndex]}
                      className="w-full h-full object-cover"
                      muted
                    />
                  ) : (
                    <img
                      src={previews[activeIndex]}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
              )}
            </DragOverlay>
          </DndContext>
        </div>
      )}
    </>
  );
}
