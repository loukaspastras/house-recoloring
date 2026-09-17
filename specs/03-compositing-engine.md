# Spec 03 — Real-Time Compositing & Export Engine

## Goal

A browser engine that recolors walls in real time (60 FPS target, <16 ms swap)
by replacing the **Hue** and **Saturation** of wall pixels while **strictly
preserving the original Lightness** channel, and exports the result at full
native resolution without blocking the UI.

## Design (Lightness-LUT approach)

1. **One-time precompute** on load (full-res `ImageData`):
   - `lightness[]` (`Uint16Array`) = `max(r,g,b) + min(r,g,b)` per pixel
     (0–510 → exact 8-bit HSL lightness, no precision loss).
   - `aiMask[]` (`Uint8Array`, 0/255) from the binary mask PNG.
2. **On color change** (cheap, no per-pixel HSL trig):
   - Build a **511-entry LUT**: for each lightness `L`, compute
     `hslToRgb(targetH, targetS, L/510)` → 3 bytes.
   - Single pass over pixels: wall pixels read `LUT[lightness[i]]`; non-wall
     pixels are copied; partial-mask edge pixels are blended by mask alpha.
3. **Brush refinement** (`Uint8Array`, 128 = neutral): "add" strokes push
   toward 255, "erase" toward 0, with soft circular falloff; combined mask =
   `refine == 128 ? aiMask : refine`. Only the dirty bbox is recomposited.

### Files

- `src/lib/paint/colorMath.ts` — `hexToRgb`, `rgbToHsl`, `hslToRgb`,
  `hexToHsl`, `hslToHex` (pure, fully tested).
- `src/lib/paint/paintEngine.ts` — `computeLightness`,
  `buildLightnessLut`, `applyRecolor` (full + region), `combineMasks`,
  `applyBrushStamp` (pure typed-array ops, DOM-free).
- `src/lib/paint/exportImage.ts` — `exportCanvasToBlob(canvas)` →
  `Promise<Blob>`, `triggerDownload(blob, filename)`,
  `buildExportFilename(hex)` (`recolored-house-#2a4d69.png`).
- `src/hooks/useWallPainter.ts` — React hook wiring `ImageData`/canvas to the
  engine, exposing `load`, `setColor`, `applyBrush`, `toggleMaskOverlay`,
  `exportImage`.

### Export helper contract (per task spec)

```ts
const exportImage = (canvas, colorHex) => {
  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = `recolored-house-${colorHex.replace("#", "")}.png`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  }, "image/png", 1.0);
};
```

## Tests

- `src/lib/paint/__tests__/colorMath.test.ts` — HSL↔RGB round trips,
  known values, hex parsing.
- `src/lib/paint/__tests__/paintEngine.test.ts` — **lightness is preserved**
  exactly after recolor; non-wall pixels untouched; mask gating; brush
  stamp/combine; **swap time < 16 ms on a 1920×1080 buffer**.
- `src/lib/paint/__tests__/exportImage.test.ts` — blob generation via mocked
  `toBlob`, filename format, `URL.createObjectURL`/`revoke` called.

## Verify

```bash
npm test && npm run typecheck && npm run build
```
