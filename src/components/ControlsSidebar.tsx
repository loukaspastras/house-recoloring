"use client";

import { useState } from "react";
import { HexColorPicker } from "react-colorful";
import { Download, Eraser, Paintbrush, RotateCcw } from "lucide-react";
import { cn } from "@/lib/cn";
import { PAINT_PRESETS } from "@/lib/palette";
import type { BrushMode } from "@/lib/paint/paintEngine";
import type { useWallPainter } from "@/hooks/useWallPainter";

interface ControlsSidebarProps {
  painter: ReturnType<typeof useWallPainter>;
  brushMode: BrushMode;
  setBrushMode: (mode: BrushMode) => void;
  brushRadius: number;
  setBrushRadius: (value: number) => void;
  brushHardness: number;
  setBrushHardness: (value: number) => void;
}

export function ControlsSidebar({
  painter,
  brushMode,
  setBrushMode,
  brushRadius,
  setBrushRadius,
  brushHardness,
  setBrushHardness,
}: ControlsSidebarProps) {
  const ready = painter.status === "ready";

  return (
    <aside className="flex flex-col gap-6 rounded-2xl border border-neutral-200 bg-white p-5">
      <button
        type="button"
        onClick={painter.download}
        disabled={!ready}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Download className="h-4 w-4" />
        Download Image
      </button>

      <ColorSection painter={painter} disabled={!ready} />

      <OpacitySection
        opacity={painter.opacity}
        onOpacity={painter.setOpacity}
        disabled={!ready}
      />

      <BrushSection
        brushMode={brushMode}
        setBrushMode={setBrushMode}
        brushRadius={brushRadius}
        setBrushRadius={setBrushRadius}
        brushHardness={brushHardness}
        setBrushHardness={setBrushHardness}
        onReset={painter.resetBrush}
        disabled={!ready}
      />
    </aside>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{children}</h3>;
}

function ColorSection({
  painter,
  disabled,
}: {
  painter: ReturnType<typeof useWallPainter>;
  disabled: boolean;
}) {
  return (
    <div className={cn("flex flex-col gap-3", disabled && "pointer-events-none opacity-50")}>
      <SectionTitle>Wall color</SectionTitle>
      <div className="rounded-lg [&_.react-colorful]:w-full [&_.react-colorful]:!h-40">
        <HexColorPicker color={painter.color} onChange={painter.setColor} />
      </div>
      <HexInput color={painter.color} onChange={painter.setColor} />
      <div className="grid grid-cols-4 gap-2">
        {PAINT_PRESETS.map((preset) => (
          <button
            key={preset.hex}
            type="button"
            title={preset.name}
            aria-label={preset.name}
            onClick={() => painter.setColor(preset.hex)}
            className={cn(
              "h-9 w-full rounded-md border border-neutral-200 transition-transform hover:scale-105",
              painter.color.toLowerCase() === preset.hex && "ring-2 ring-indigo-500 ring-offset-1",
            )}
            style={{ backgroundColor: preset.hex }}
          />
        ))}
      </div>
    </div>
  );
}

function HexInput({ color, onChange }: { color: string; onChange: (hex: string) => void }) {
  const [draft, setDraft] = useState(color);
  const [prevColor, setPrevColor] = useState(color);

  // Sync the draft when the selected color changes from outside (picker,
  // presets). This is React's documented "adjust state during render"
  // pattern, which avoids a cascading setState-in-effect.
  if (color !== prevColor) {
    setPrevColor(color);
    setDraft(color);
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2">
      <span
        className="h-5 w-5 shrink-0 rounded-full border border-neutral-200"
        style={{ backgroundColor: color }}
      />
      <input
        value={draft}
        onChange={(e) => {
          const value = e.target.value;
          setDraft(value);
          if (/^#?[0-9a-fA-F]{6}$/.test(value)) onChange(value);
        }}
        spellCheck={false}
        aria-label="Hex color"
        className="w-full bg-transparent font-mono text-sm text-neutral-800 outline-none"
      />
    </div>
  );
}

function OpacitySection({
  opacity,
  onOpacity,
  disabled,
}: {
  opacity: number;
  onOpacity: (value: number) => void;
  disabled: boolean;
}) {
  return (
    <div className={cn("flex flex-col gap-2", disabled && "pointer-events-none opacity-50")}>
      <div className="flex items-center justify-between">
        <SectionTitle>Color strength</SectionTitle>
        <span className="text-xs font-medium text-neutral-500">{Math.round(opacity * 100)}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={opacity}
        onChange={(e) => onOpacity(Number(e.target.value))}
        aria-label="Color strength"
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-neutral-200 accent-indigo-600"
      />
    </div>
  );
}

function BrushSection({
  brushMode,
  setBrushMode,
  brushRadius,
  setBrushRadius,
  brushHardness,
  setBrushHardness,
  onReset,
  disabled,
}: {
  brushMode: BrushMode;
  setBrushMode: (mode: BrushMode) => void;
  brushRadius: number;
  setBrushRadius: (value: number) => void;
  brushHardness: number;
  setBrushHardness: (value: number) => void;
  onReset: () => void;
  disabled: boolean;
}) {
  return (
    <div className={cn("flex flex-col gap-3", disabled && "pointer-events-none opacity-50")}>
      <div className="flex items-center justify-between">
        <SectionTitle>Touch up mask</SectionTitle>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1 text-xs font-medium text-neutral-500 hover:text-neutral-800"
        >
          <RotateCcw className="h-3 w-3" />
          Reset
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setBrushMode("add")}
          className={cn(
            "inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
            brushMode === "add"
              ? "border-indigo-600 bg-indigo-50 text-indigo-700"
              : "border-neutral-200 text-neutral-600 hover:bg-neutral-50",
          )}
        >
          <Paintbrush className="h-3.5 w-3.5" />
          Add wall
        </button>
        <button
          type="button"
          onClick={() => setBrushMode("erase")}
          className={cn(
            "inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
            brushMode === "erase"
              ? "border-indigo-600 bg-indigo-50 text-indigo-700"
              : "border-neutral-200 text-neutral-600 hover:bg-neutral-50",
          )}
        >
          <Eraser className="h-3.5 w-3.5" />
          Erase
        </button>
      </div>

      <label className="flex flex-col gap-1">
        <span className="flex justify-between text-xs text-neutral-500">
          <span>Brush size</span>
          <span className="font-medium">{brushRadius}px</span>
        </span>
        <input
          type="range"
          min={4}
          max={120}
          step={1}
          value={brushRadius}
          onChange={(e) => setBrushRadius(Number(e.target.value))}
          aria-label="Brush size"
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-neutral-200 accent-indigo-600"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="flex justify-between text-xs text-neutral-500">
          <span>Edge softness</span>
          <span className="font-medium">{Math.round(brushHardness * 100)}%</span>
        </span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={brushHardness}
          onChange={(e) => setBrushHardness(Number(e.target.value))}
          aria-label="Edge softness"
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-neutral-200 accent-indigo-600"
        />
      </label>
    </div>
  );
}
