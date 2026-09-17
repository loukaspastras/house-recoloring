/** Curated architectural paint presets shown in the sidebar. */
export interface PaintPreset {
  name: string;
  hex: string;
}

export const PAINT_PRESETS: PaintPreset[] = [
  { name: "Off-White", hex: "#e8e4da" },
  { name: "Warm Beige", hex: "#d8c7b3" },
  { name: "Terracotta", hex: "#b5654a" },
  { name: "Sage", hex: "#9caf88" },
  { name: "Forest Green", hex: "#3e5c4b" },
  { name: "Navy", hex: "#2a4d69" },
  { name: "Charcoal", hex: "#3a3a3c" },
  { name: "Slate Blue", hex: "#5b7c99" },
];
