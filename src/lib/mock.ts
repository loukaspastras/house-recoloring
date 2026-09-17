import type { WallRegion } from "./types";

/**
 * Deterministic mock segmentation used when the Gemini key is absent or the
 * API call fails. It returns two plausible wall polygons (a broad front wall
 * and a narrower side wall) so the full UI remains exercisable end-to-end
 * without network access. Coordinates are normalized to [0, 1].
 */
export function mockWallRegions(width: number, height: number): WallRegion[] {
  void width;
  void height;

  return [
    {
      label: "front wall",
      polygon: [
        { x: 0.12, y: 0.28 },
        { x: 0.88, y: 0.28 },
        { x: 0.88, y: 0.9 },
        { x: 0.12, y: 0.9 },
      ],
    },
    {
      label: "side wall",
      polygon: [
        { x: 0.88, y: 0.38 },
        { x: 0.97, y: 0.44 },
        { x: 0.97, y: 0.82 },
        { x: 0.88, y: 0.9 },
      ],
    },
  ];
}
