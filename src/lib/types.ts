/**
 * Shared domain types used across the server segmentation pipeline and the
 * browser compositing engine.
 */

export interface Point {
  x: number;
  y: number;
}

/** An ordered list of vertices. Coordinates are normalized to [0, 1]. */
export type Polygon = Point[];

/** A single paintable wall / exterior siding region identified by Gemini. */
export interface WallRegion {
  label: string;
  polygon: Polygon;
}

/** Provenance of the produced wall mask. */
export type MaskSource = "gemini-edit" | "gemini" | "mock" | "empty";

/** Result of the server-side segmentation step. */
export interface SegmentResult {
  width: number;
  height: number;
  /** Per-pixel mask: 255 = paintable wall, 0 = everything else. */
  mask: Uint8Array;
  source: MaskSource;
  regions: WallRegion[];
}

/** Final PNG payload returned by the /api/segment endpoint. */
export interface SegmentPng {
  png: Buffer;
  width: number;
  height: number;
  source: MaskSource;
}
