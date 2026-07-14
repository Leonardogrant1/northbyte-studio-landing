# Kanban Item Detail Dialog — Design

**Datum:** 2026-07-14
**Status:** Genehmigt

## Ziel

Kanban-Karten in den Admin-Boards (Bugs, Features, Creator Applications) sollen per kleinem Expand-Icon geöffnet werden können. Ein Dialog zeigt die vollständigen Details des Items (read-only, kein Bearbeiten).

## Kontext

Alle drei Boards nutzen die gemeinsame Komponente `apps/web/src/components/admin/GenericKanbanBoard.tsx`:

- `BugKanbanBoard.tsx` und `FeatureKanbanBoard.tsx` nutzen das Default-Card-Rendering (Titel, gekürzte Beschreibung, Upvotes).
- `CreatorApplicationBoard.tsx` nutzt ein eigenes `renderCardContent` (Name, E-Mail, Telefon, Land, Socials, gekürzte Beschreibung, Video-Link).

Karten sind per dnd-kit (`useSortable`, `PointerSensor` mit `distance: 8`) draggable.

## Design

### 1. Expand-Icon auf der Karte (`GenericKanbanBoard.tsx` → `ItemCard`)

- `Expand`-Icon (lucide-react) als Button oben rechts in der Karte, absolut positioniert.
- Sichtbar beim Hover über die Karte (`group` / `group-hover:opacity-100`), zusätzlich bei Fokus.
- `onPointerDown` mit `stopPropagation`, damit der Klick nicht die dnd-kit-Drag-Sensorik aktiviert.
- Nicht gerendert im Drag-Overlay (`isOverlay`).

### 2. Detail-Dialog (`KanbanDetailDialog` in `GenericKanbanBoard.tsx`)

- State in `GenericKanbanBoard`: `useState<TItem | null>` — Klick auf Expand setzt das Item, Dialog rendert konditional.
- Styling analog `EditContentModal`: fixed Overlay, `bg-black/60 backdrop-blur-sm` Backdrop, zentrierte Box (`max-w-2xl`, `bg-surface`, `rounded-2xl`, `border-border`).
- Schließen per X-Button, Backdrop-Klick und Escape-Taste.
- Generische Teile: Header mit `item.title` + X-Button; Status-Badge mit Spaltenfarbe aus der `columns`-Config.
- Body: neues optionales Prop `renderDetailContent?: (item: TItem) => ReactNode`, sonst Default.

### 3. Inhalte pro Board

- **Bugs & Features (Default):** vollständige Beschreibung (ohne line-clamp), Upvotes.
- **Applications (`renderDetailContent` in `CreatorApplicationBoard.tsx`):** E-Mail (mailto), Telefon, Land, Social Accounts, vollständige Beschreibung, Video-Link, Bewerbungsdatum aus `_creationTime`.

## Nicht im Scope

- Kein Bearbeiten von Feldern im Dialog.
- Keine Backend-/Convex-Änderungen — alle Daten sind bereits in den geladenen Items enthalten.

## Betroffene Dateien

- `apps/web/src/components/admin/GenericKanbanBoard.tsx` (Icon, Dialog, neues Prop)
- `apps/web/src/components/admin/CreatorApplicationBoard.tsx` (Detail-Renderer)
- `BugKanbanBoard.tsx` / `FeatureKanbanBoard.tsx`: keine Änderung nötig
