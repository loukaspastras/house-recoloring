"use client";

import { useState } from "react";
import { Palette } from "lucide-react";
import { useWallPainter, DEFAULT_COLOR } from "@/hooks/useWallPainter";
import { segmentImage } from "@/lib/api";
import type { BrushMode } from "@/lib/paint/paintEngine";
import { UploadZone } from "./UploadZone";
import { CanvasWorkspace } from "./CanvasWorkspace";
import { ControlsSidebar } from "./ControlsSidebar";

export function HouseRecolorApp() {
  const painter = useWallPainter();

  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [segmenting, setSegmenting] = useState(false);
  const [segmentError, setSegmentError] = useState<string | null>(null);

  const [brushMode, setBrushMode] = useState<BrushMode>("add");
  const [brushRadius, setBrushRadius] = useState(28);
  const [brushHardness, setBrushHardness] = useState(0.75);

  async function handleFile(file: File) {
    setOriginalFile(file);
    setSegmentError(null);
    setSegmenting(true);
    try {
      const mask = await segmentImage(file);
      await painter.load(file, mask, DEFAULT_COLOR);
    } catch (err) {
      setSegmentError(err instanceof Error ? err.message : "Failed to segment the image");
    } finally {
      setSegmenting(false);
    }
  }

  function handleNewImage() {
    setOriginalFile(null);
    setSegmentError(null);
  }

  return (
    <div className="flex min-h-screen flex-col bg-neutral-50">
      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center gap-2 px-6 py-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <Palette className="h-4.5 w-4.5" />
          </span>
          <div>
            <h1 className="text-sm font-semibold leading-tight text-neutral-900">
              House Recoloring
            </h1>
            <p className="text-xs leading-tight text-neutral-500">
              AI wall segmentation · real-time HSL recoloring
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-6">
        {!originalFile ? (
          <UploadZone onFile={handleFile} disabled={segmenting} error={segmentError} />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
            <CanvasWorkspace
              painter={painter}
              brushMode={brushMode}
              brushRadius={brushRadius}
              brushHardness={brushHardness}
              segmenting={segmenting}
              onNewImage={handleNewImage}
            />
            <ControlsSidebar
              painter={painter}
              brushMode={brushMode}
              setBrushMode={setBrushMode}
              brushRadius={brushRadius}
              setBrushRadius={setBrushRadius}
              brushHardness={brushHardness}
              setBrushHardness={setBrushHardness}
            />
          </div>
        )}
      </main>
    </div>
  );
}
