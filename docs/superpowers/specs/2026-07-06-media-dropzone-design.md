# MediaDropzone — Design Spec

**Date:** 2026-07-06
**Scope:** post-content admin page — replace current media strip with a drop zone + sortable grid

---

## Goal

Replace the small horizontal thumbnail strip and `+` button in the Medien section with a prominent drop zone that transforms into a sortable media grid once files are added.

---

## Architecture

### New component: `src/components/admin/MediaDropzone.tsx`

Pure presentational component. Parent owns state; component receives:

```ts
interface MediaDropzoneProps {
  files: File[];
  previews: string[];
  onAdd: (files: File[]) => void;
  onRemove: (index: number) => void;
  onReorder: (files: File[], previews: string[]) => void;
  disabled?: boolean;
}
```

### Edit: `src/app/admin/(dashboard)/post-content/page.tsx`

- Replace the current Medien `<section>` (lines 358–400) with `<MediaDropzone>`
- Pass existing `mediaFiles`, `previews`, `addFiles`, `removeFile` and a new `handleReorder` callback
- Remove `fileInputRef` (moved into the component)

---

## States

### Empty state

- Full-height dashed drop zone (`border-2 border-dashed border-border`)
- Centered: upload icon, "Dateien ablegen oder klicken", subtext "Video & Bilder"
- On `dragover`: highlight border (`border-accent`) + light background tint
- On `dragleave` / `drop`: return to default
- On click: opens hidden `<input type="file" multiple accept="video/*,image/*">`

### Filled state

- **Add-more strip** at top: compact (height ~40px), same drop + click behavior, `+` icon with "Weitere hinzufügen" label
- **Sortable grid** below: wrapping flex/grid of portrait thumbnails (`w-20 h-32`)
  - Videos: `<video src={preview} muted className="object-cover">`
  - Images: `<img src={preview} className="object-cover">`
  - Each item: `X` remove button (top-right overlay)
  - Drag handle: entire thumbnail is draggable

---

## Drag-to-reorder (dnd-kit)

- `DndContext` wraps the grid; `SortableContext` with `items` = index array
- Each thumbnail uses `useSortable({ id: index })`
- `DragOverlay` renders a ghost copy of the active thumbnail
- `handleDragEnd`: calls `arrayMove` on both `files` and `previews` arrays, then calls `onReorder(newFiles, newPreviews)`
- Sensor: `PointerSensor` with a 5px activation distance to avoid accidental drags

---

## File input

- Native HTML5 events for OS → browser file drops (`onDrop`, `onDragOver`, `onDragLeave`)
- Hidden `<input type="file" multiple accept="video/*,image/*">` for click-to-browse
- Both the empty drop zone and the filled add-more strip share this behavior
- dnd-kit is used **only** for in-grid reordering, not for OS file drops

---

## Files changed

| File | Change |
|------|--------|
| `src/components/admin/MediaDropzone.tsx` | New component |
| `src/app/admin/(dashboard)/post-content/page.tsx` | Swap Medien section, add `handleReorder`, remove `fileInputRef` |
