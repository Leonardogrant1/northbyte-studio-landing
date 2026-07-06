# MediaDropzone Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current horizontal media strip in the post-content admin page with a prominent drop zone that transforms into a reorderable media grid once files are added.

**Architecture:** A new `MediaDropzone` component handles both OS file drops (native HTML5 drag events) and in-grid reordering (dnd-kit sortable). The parent page keeps its existing `mediaFiles`/`previews` state and passes callbacks down. Two visual states: an empty full-height drop zone, and a filled state with a compact add-more strip plus a sortable thumbnail grid.

**Tech Stack:** React, dnd-kit (`@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`), Tailwind CSS, Lucide icons

## Global Constraints

- Tailwind only — no inline styles except dnd-kit transform/transition (required for animation)
- Accept `video/*` and `image/*` only
- Follow existing dnd-kit patterns from `src/components/admin/GenericKanbanBoard.tsx`: `PointerSensor` with `activationConstraint: { distance: 8 }`, `CSS.Transform.toString`, `DragOverlay`
- No new dependencies — dnd-kit is already installed
- No testing framework exists — verification is manual via dev server

---

### Task 1: Create MediaDropzone component

**Files:**
- Create: `src/components/admin/MediaDropzone.tsx`

**Interfaces:**
- Produces:
  ```ts
  export function MediaDropzone(props: MediaDropzoneProps): JSX.Element
  
  interface MediaDropzoneProps {
    files: File[];
    previews: string[];            // object URLs, parallel array with files
    onAdd: (files: File[]) => void;
    onRemove: (index: number) => void;
    onReorder: (files: File[], previews: string[]) => void;
    disabled?: boolean;
  }
  ```

- [ ] **Step 1: Create the file with the SortableThumb sub-component**

  `src/components/admin/MediaDropzone.tsx`:
  ```tsx
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

    const openPicker = () => fileInputRef.current?.click();
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
  ```

- [ ] **Step 2: Verify TypeScript compiles**

  Run: `npx tsc --noEmit`
  Expected: no errors for the new file

- [ ] **Step 3: Commit**

  ```bash
  git add src/components/admin/MediaDropzone.tsx
  git commit -m "feat: add MediaDropzone component with sortable grid and OS file drop"
  ```

---

### Task 2: Integrate MediaDropzone into post-content page

**Files:**
- Modify: `src/app/admin/(dashboard)/post-content/page.tsx`

**Interfaces:**
- Consumes:
  ```ts
  import { MediaDropzone } from "@/components/admin/MediaDropzone";
  // MediaDropzone(props: MediaDropzoneProps): JSX.Element — see Task 1
  ```

- [ ] **Step 1: Update imports**

  In `post-content/page.tsx`, change line 3–9 from:
  ```ts
  import { useRef, useState } from "react";
  import { useQuery, useMutation, useConvexAuth } from "convex/react";
  import { api } from "@/convex/_generated/api";
  import { Id } from "@/convex/_generated/dataModel";
  import { Calendar, Loader2, Plus, X } from "lucide-react";
  import { normalizeVideoFile } from "@/lib/video";
  import { toast } from "sonner";
  import { R2_BUCKETS } from "@/lib/r2-constants";
  ```
  to:
  ```ts
  import { useState } from "react";
  import { useQuery, useMutation, useConvexAuth } from "convex/react";
  import { api } from "@/convex/_generated/api";
  import { Id } from "@/convex/_generated/dataModel";
  import { Calendar, Loader2, X } from "lucide-react";
  import { normalizeVideoFile } from "@/lib/video";
  import { toast } from "sonner";
  import { R2_BUCKETS } from "@/lib/r2-constants";
  import { MediaDropzone } from "@/components/admin/MediaDropzone";
  ```
  (Removed: `useRef`, `Plus`. Added: `MediaDropzone` import.)

- [ ] **Step 2: Remove fileInputRef**

  Delete line 129:
  ```ts
  const fileInputRef = useRef<HTMLInputElement>(null);
  ```

- [ ] **Step 3: Replace the Medien section**

  In `post-content/page.tsx`, replace lines 358–400 (the entire `{/* Media picker */}` section):
  ```tsx
  {/* Media picker */}
  <section className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-secondary">
          Medien
      </h2>
      <div className="flex gap-2 overflow-x-auto pb-1">
          {previews.map((url, i) => (
              <div
                  key={i}
                  className="relative flex-shrink-0 w-20 h-32 rounded-lg overflow-hidden border border-border bg-surface2"
              >
                  {mediaFiles[i].type.startsWith("video/") ? (
                      <video src={url} className="w-full h-full object-cover" muted />
                  ) : (
                      <img src={url} alt="" className="w-full h-full object-cover" />
                  )}
                  <button
                      onClick={() => removeFile(i)}
                      className="absolute top-1 right-1 p-0.5 rounded-full bg-black/60 hover:bg-black/80 transition-colors"
                  >
                      <X size={12} className="text-white" />
                  </button>
              </div>
          ))}
          <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isScheduling}
              className="flex-shrink-0 w-20 h-32 rounded-lg border-2 border-dashed border-border hover:border-accent/50 hover:bg-surface2/50 flex items-center justify-center transition-colors disabled:opacity-50"
          >
              <Plus size={20} className="text-secondary" />
          </button>
          <input
              ref={fileInputRef}
              type="file"
              accept="video/*,image/*"
              multiple
              onChange={(e) => {
                  if (e.target.files) addFiles(Array.from(e.target.files));
                  e.target.value = "";
              }}
              className="hidden"
          />
      </div>
  </section>
  ```
  with:
  ```tsx
  {/* Media picker */}
  <section className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-secondary">
          Medien
      </h2>
      <MediaDropzone
          files={mediaFiles}
          previews={previews}
          onAdd={addFiles}
          onRemove={removeFile}
          onReorder={(newFiles, newPreviews) => {
              setMediaFiles(newFiles);
              setPreviews(newPreviews);
          }}
          disabled={isScheduling}
      />
  </section>
  ```

- [ ] **Step 4: Verify TypeScript compiles**

  Run: `npx tsc --noEmit`
  Expected: no errors

- [ ] **Step 5: Start dev server and verify manually**

  Run: `npm run dev`

  Check the following in the browser at `/admin/post-content`:
  - [ ] Medien section shows a large dashed drop zone with upload icon and German labels
  - [ ] Clicking the drop zone opens the OS file picker (multiple files selectable)
  - [ ] Dropping image/video files from the OS onto the zone adds them as thumbnails
  - [ ] After files are added, zone shrinks to compact "Weitere hinzufügen" strip
  - [ ] Thumbnails can be dragged to reorder — ghost overlay appears while dragging
  - [ ] X button removes individual files without triggering drag
  - [ ] Clicking the compact strip (filled state) also opens the file picker
  - [ ] Dropping more files onto the compact strip appends them to the grid
  - [ ] `disabled` state (while scheduling) prevents remove button interaction

- [ ] **Step 6: Commit**

  ```bash
  git add src/app/admin/\(dashboard\)/post-content/page.tsx
  git commit -m "feat: integrate MediaDropzone into post-content page"
  ```
