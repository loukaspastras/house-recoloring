# Spec 04 — Frontend UI / UX

## Goal

A polished, responsive single-page workspace: upload → segment → recolor →
refine → export.

## Layout

- **Header**: brand + tagline.
- **Upload Hero** (empty state): drag-and-drop + click-to-browse, JPEG/PNG,
  ≤15 MB, with paste support.
- **Canvas Workspace**: full-resolution composite, mask-overlay toggle,
  zoom-to-fit, brush cursor.
- **Sidebar Controls**:
  - Color wheel (`react-colorful` `HexColorPicker`) + native hex input.
  - Preset palette: Off-White `#e8e4da`, Warm Beige `#d8c7b3`, Terracotta
    `#b5654a`, Sage `#9caf88`, Forest Green `#3e5c4b`, Navy `#2a4d69`,
    Charcoal `#3a3a3c`, Slate Blue `#5b7c99`.
  - Brush tool: `add`/`erase` toggle + radius slider.
  - Opacity slider (post-process global alpha on the recolored layer).
  - **Download Image** button (primary, always visible once an image loads).

## Interaction flow

1. Drop image → optimistic preview → `POST /api/segment`.
2. On mask → init `useWallPainter` engine with base + mask.
3. Color/preset/opacity → engine `setColor` (no network).
4. Brush → engine `applyBrush` on dirty region.
5. Download → `exportImage(canvas, hex)` via `toBlob` (non-blocking).

## Components

`src/components/` — `UploadZone`, `CanvasWorkspace`, `ControlSidebar`,
`ColorControls`, `BrushControls`, `DownloadButton`, `Spinner`, `ErrorBanner`,
`MaskLegend`. Client-side only (`"use client"`).

## Accessibility / UX

- Keyboard-accessible buttons, `aria-labels`, focus states.
- Loading + error states with retry.
- No console errors; no `TODO`/stub code.

## Verify

```bash
npm test && npm run typecheck && npm run lint && npm run build
```
