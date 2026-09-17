import type { Point, Polygon } from "./types";

/** Clamp a number into [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/**
 * Convert normalized [0, 1] polygon coordinates into pixel-space points for a
 * target raster of the given dimensions. `n * width` maps a normalized
 * coordinate onto a pixel *boundary*, so a full-frame polygon spans exactly
 * [0, width] × [0, height].
 */
export function denormalizePolygons(
  polygons: Polygon[],
  width: number,
  height: number,
): Point[][] {
  return polygons.map((polygon) =>
    polygon.map((point) => ({
      x: clamp(point.x, 0, 1) * width,
      y: clamp(point.y, 0, 1) * height,
    })),
  );
}

/**
 * Rasterize a set of normalized polygons into a binary mask using an even-odd
 * scanline fill. White (255) = inside a wall region, black (0) = outside.
 */
export function rasterizePolygons(
  polygons: Polygon[],
  width: number,
  height: number,
): Uint8Array {
  const mask = new Uint8Array(width * height);
  const pixelPolygons = denormalizePolygons(polygons, width, height);
  for (const polygon of pixelPolygons) {
    fillPolygon(mask, width, height, polygon);
  }
  return mask;
}

/**
 * Even-odd scanline polygon fill. For every integer scanline `y`, collect the
 * x-coordinates where the polygon edges cross the horizontal line at `y + 0.5`
 * and fill the alternating spans between them.
 */
export function fillPolygon(
  mask: Uint8Array,
  width: number,
  height: number,
  points: Point[],
): void {
  const n = points.length;
  if (n < 3) return;

  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const p of points) {
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  // Fill only pixels whose *center* (y + 0.5) lies strictly inside the
  // polygon's vertical extent.
  const yStart = Math.max(0, Math.ceil(minY - 0.5));
  const yEnd = Math.min(height - 1, Math.floor(maxY - 0.5));

  for (let y = yStart; y <= yEnd; y++) {
    const scanY = y + 0.5;
    const xs: number[] = [];

    for (let i = 0; i < n; i++) {
      const a = points[i];
      const b = points[(i + 1) % n];
      // Crossings are detected with a half-open rule (a.y <= scanY < b.y or
      // b.y <= scanY < a.y) so horizontal edges never contribute and shared
      // vertices are counted exactly once.
      if ((a.y <= scanY && b.y > scanY) || (b.y <= scanY && a.y > scanY)) {
        const t = (scanY - a.y) / (b.y - a.y);
        xs.push(a.x + t * (b.x - a.x));
      }
    }

    xs.sort((p, q) => p - q);

    for (let i = 0; i + 1 < xs.length; i += 2) {
      // Same center rule applied horizontally.
      const xA = Math.max(0, Math.ceil(xs[i] - 0.5));
      const xB = Math.min(width - 1, Math.floor(xs[i + 1] - 0.5));
      if (xA <= xB) {
        mask.fill(255, y * width + xA, y * width + xB + 1);
      }
    }
  }
}
