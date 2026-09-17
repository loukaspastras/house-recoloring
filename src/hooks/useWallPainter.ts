"use client";

import { useCallback, useRef, useState } from "react";
import {
  applyBrushStamp,
  applyRecolor,
  buildCombinedMask,
  buildLightnessLut,
  computeLightness,
  REFINE_NEUTRAL,
  type BrushMode,
  type Region,
} from "@/lib/paint/paintEngine";
import { hexToHsl, normalizeHex } from "@/lib/paint/colorMath";
import { exportImage as downloadImage } from "@/lib/paint/exportImage";

export const DEFAULT_COLOR = "#2a4d69";

export type PainterStatus = "idle" | "loading" | "ready" | "error";

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to decode image"));
    };
    img.src = url;
  });
}

/**
 * Manages the two-canvas paint pipeline:
 *  - `canvasRef`  → the visible full-resolution composite (recolored house)
 *  - `overlayRef` → a translucent red mask overlay (toggled in the UI)
 *
 * The heavy lifting is delegated to the pure functions in `paintEngine`.
 */
export function useWallPainter() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);

  const [status, setStatus] = useState<PainterStatus>("idle");
  const [color, setColorState] = useState(DEFAULT_COLOR);
  const [opacity, setOpacityState] = useState(1);
  const [showOverlay, setShowOverlay] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Engine state (typed arrays + dimensions).
  const widthRef = useRef(0);
  const heightRef = useRef(0);
  const baseRef = useRef<Uint8ClampedArray | null>(null);
  const lightnessRef = useRef<Uint16Array | null>(null);
  const aiMaskRef = useRef<Uint8Array | null>(null);
  const refineRef = useRef<Uint8Array | null>(null);
  const combinedRef = useRef<Uint8Array | null>(null);
  const lutRef = useRef<Uint32Array | null>(null);
  const outRef = useRef<ImageData | null>(null);
  const overlayDataRef = useRef<ImageData | null>(null);

  const colorRef = useRef(DEFAULT_COLOR);
  const opacityRef = useRef(1);

  const render = useCallback((region?: Region) => {
    const canvas = canvasRef.current;
    const out = outRef.current;
    const base = baseRef.current;
    const lightness = lightnessRef.current;
    const combined = combinedRef.current;
    const lut = lutRef.current;
    const width = widthRef.current;
    const height = heightRef.current;
    if (!canvas || !out || !base || !lightness || !combined || !lut || !width || !height) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    applyRecolor(out.data, base, lightness, combined, lut, width, height, region, opacityRef.current);

    if (region) {
      ctx.putImageData(
        out,
        0,
        0,
        region.x0,
        region.y0,
        region.x1 - region.x0 + 1,
        region.y1 - region.y0 + 1,
      );
    } else {
      ctx.putImageData(out, 0, 0);
    }
  }, []);

  const renderOverlay = useCallback((region?: Region) => {
    const canvas = overlayRef.current;
    const width = widthRef.current;
    const height = heightRef.current;
    const combined = combinedRef.current;
    if (!canvas || !width || !height || !combined) return;

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let data = overlayDataRef.current;
    if (!data || data.width !== width || data.height !== height) {
      data = new ImageData(width, height);
      overlayDataRef.current = data;
    }
    const px = data.data;

    const x0 = region ? Math.max(0, region.x0) : 0;
    const y0 = region ? Math.max(0, region.y0) : 0;
    const x1 = region ? Math.min(width - 1, region.x1) : width - 1;
    const y1 = region ? Math.min(height - 1, region.y1) : height - 1;

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = y * width + x;
        const m = combined[i];
        const p = i * 4;
        if (m > 0) {
          px[p] = 255;
          px[p + 1] = 45;
          px[p + 2] = 45;
          px[p + 3] = Math.min(255, Math.round((m / 255) * 165));
        } else {
          px[p] = 0;
          px[p + 1] = 0;
          px[p + 2] = 0;
          px[p + 3] = 0;
        }
      }
    }

    if (region) {
      ctx.putImageData(
        data,
        0,
        0,
        region.x0,
        region.y0,
        region.x1 - region.x0 + 1,
        region.y1 - region.y0 + 1,
      );
    } else {
      ctx.putImageData(data, 0, 0);
    }
  }, []);

  const load = useCallback(
    async (baseBlob: Blob, maskBlob: Blob, initialColor: string) => {
      setStatus("loading");
      setError(null);
      try {
        const [baseImg, maskImg] = await Promise.all([
          loadImageFromBlob(baseBlob),
          loadImageFromBlob(maskBlob),
        ]);

        const width = baseImg.naturalWidth;
        const height = baseImg.naturalHeight;
        if (!width || !height) throw new Error("Could not read image dimensions");

        // Base image → RGBA buffer + lightness map.
        const baseCanvas = createCanvas(width, height);
        const baseCtx = baseCanvas.getContext("2d", { willReadFrequently: true });
        if (!baseCtx) throw new Error("Canvas 2D context unavailable");
        baseCtx.drawImage(baseImg, 0, 0, width, height);
        const base = baseCtx.getImageData(0, 0, width, height).data;

        // Mask PNG → binary mask (scaled to the base dimensions just in case).
        const maskCanvas = createCanvas(width, height);
        const maskCtx = maskCanvas.getContext("2d", { willReadFrequently: true });
        if (!maskCtx) throw new Error("Canvas 2D context unavailable");
        maskCtx.drawImage(maskImg, 0, 0, width, height);
        const maskData = maskCtx.getImageData(0, 0, width, height).data;

        const aiMask = new Uint8Array(width * height);
        for (let i = 0; i < width * height; i++) {
          aiMask[i] = maskData[i * 4] >= 128 ? 255 : 0;
        }

        const lightness = computeLightness(base);
        const refine = new Uint8Array(width * height).fill(REFINE_NEUTRAL);
        const combined = new Uint8Array(width * height);
        buildCombinedMask(aiMask, refine, combined);

        const canvas = canvasRef.current;
        if (!canvas) throw new Error("Canvas element not mounted");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas 2D context unavailable");

        widthRef.current = width;
        heightRef.current = height;
        baseRef.current = base;
        lightnessRef.current = lightness;
        aiMaskRef.current = aiMask;
        refineRef.current = refine;
        combinedRef.current = combined;
        outRef.current = new ImageData(width, height);

        const normalized = normalizeHex(initialColor);
        const { h, s } = hexToHsl(normalized);
        lutRef.current = buildLightnessLut(h, s);
        colorRef.current = normalized;

        render();
        renderOverlay();
        setColorState(normalized);
        setStatus("ready");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to process image");
        setStatus("error");
      }
    },
    [render, renderOverlay],
  );

  const setColor = useCallback(
    (hex: string) => {
      const normalized = normalizeHex(hex);
      const { h, s } = hexToHsl(normalized);
      lutRef.current = buildLightnessLut(h, s);
      colorRef.current = normalized;
      setColorState(normalized);
      render();
    },
    [render],
  );

  const setOpacity = useCallback(
    (value: number) => {
      const clamped = Math.min(1, Math.max(0, value));
      opacityRef.current = clamped;
      setOpacityState(clamped);
      render();
    },
    [render],
  );

  const brush = useCallback(
    (x: number, y: number, radius: number, hardness: number, mode: BrushMode) => {
      const canvas = canvasRef.current;
      const width = widthRef.current;
      const height = heightRef.current;
      const refine = refineRef.current;
      const combined = combinedRef.current;
      const aiMask = aiMaskRef.current;
      if (!canvas || !refine || !combined || !aiMask || !width || !height) return;

      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const scaleX = width / rect.width;
      const scaleY = height / rect.height;

      const bbox = applyBrushStamp(
        refine,
        combined,
        aiMask,
        width,
        height,
        x * scaleX,
        y * scaleY,
        radius * Math.max(scaleX, scaleY),
        hardness,
        mode,
      );
      if (bbox) {
        render(bbox);
        renderOverlay(bbox);
      }
    },
    [render, renderOverlay],
  );

  const resetBrush = useCallback(() => {
    const refine = refineRef.current;
    const aiMask = aiMaskRef.current;
    const combined = combinedRef.current;
    if (!refine || !aiMask || !combined) return;
    refine.fill(REFINE_NEUTRAL);
    buildCombinedMask(aiMask, refine, combined);
    render();
    renderOverlay();
  }, [render, renderOverlay]);

  const download = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      await downloadImage(canvas, colorRef.current);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    }
  }, []);

  const toggleOverlay = useCallback(() => setShowOverlay((value) => !value), []);

  return {
    canvasRef,
    overlayRef,
    status,
    error,
    color,
    opacity,
    showOverlay,
    load,
    setColor,
    setOpacity,
    brush,
    resetBrush,
    download,
    toggleOverlay,
  };
}
