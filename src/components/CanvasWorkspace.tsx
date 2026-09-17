"use client";

import { useRef } from "react";
import { Eye, EyeOff, Loader2, RotateCcw } from "lucide-react";
import { cn } from "@/lib/cn";
import type { BrushMode } from "@/lib/paint/paintEngine";
import type { useWallPainter } from "@/hooks/useWallPainter";

interface CanvasWorkspaceProps {
  painter: ReturnType<typeof useWallPainter>;
  brushMode: BrushMode;
  brushRadius: number;
  brushHardness: number;
  segmenting: boolean;
  onNewImage: () => void;
}

export function CanvasWorkspace({
  painter,
  brushMode,
  brushRadius,
  brushHardness,
  segmenting,
  onNewImage,
}: CanvasWorkspaceProps) {
  const drawingRef = useRef(false);
  const ready = painter.status === "ready" && !segmenting;

  function eventPoint(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">Preview</h2>
          <p className="text-xs text-neutral-500">
            {ready
              ? "Drag on the photo with the brush to refine the wall selection."
              : segmenting
                ? "Analyzing walls…"
                : "Processing…"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={painter.toggleOverlay}
            disabled={!ready}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {painter.showOverlay ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {painter.showOverlay ? "Hide mask" : "Show mask"}
          </button>
          <button
            type="button"
            onClick={onNewImage}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            New image
          </button>
        </div>
      </div>

      <div className="relative flex min-h-[320px] w-full items-center justify-center overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-900/[0.03] p-4">
        <div className="relative inline-block max-w-full">
          <canvas
            ref={painter.canvasRef}
            onPointerDown={(e) => {
              if (!ready) return;
              drawingRef.current = true;
              e.currentTarget.setPointerCapture(e.pointerId);
              const p = eventPoint(e);
              painter.brush(p.x, p.y, brushRadius, brushHardness, brushMode);
            }}
            onPointerMove={(e) => {
              if (!drawingRef.current || !ready) return;
              const p = eventPoint(e);
              painter.brush(p.x, p.y, brushRadius, brushHardness, brushMode);
            }}
            onPointerUp={() => (drawingRef.current = false)}
            onPointerCancel={() => (drawingRef.current = false)}
            className={cn(
              "block h-auto w-auto max-h-[72vh] max-w-full rounded-lg",
              ready && (brushMode === "erase" ? "cursor-cell" : "cursor-crosshair"),
            )}
            style={{ touchAction: "none" }}
          />
          <canvas
            ref={painter.overlayRef}
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-0 h-full w-full rounded-lg transition-opacity",
              painter.showOverlay ? "opacity-100" : "opacity-0",
            )}
          />
        </div>

        {!ready && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl bg-white/80">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            <p className="text-sm font-medium text-neutral-600">
              {segmenting ? "Identifying paintable walls…" : "Preparing workspace…"}
            </p>
          </div>
        )}

        {painter.status === "error" && painter.error && (
          <div className="absolute inset-x-0 bottom-0 rounded-b-2xl bg-red-50 px-4 py-2 text-center text-sm font-medium text-red-700">
            {painter.error}
          </div>
        )}
      </div>
    </section>
  );
}
