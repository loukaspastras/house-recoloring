import type { SegmentPng, SegmentResult, WallRegion } from "./types";
import { rasterizePolygons } from "./rasterize";
import { prepareImage } from "./imageMeta";
import { detectWallRegions } from "./gemini";
import { mockWallRegions } from "./mock";
import { maskToPng } from "./maskPng";
import { segmentViaEdit } from "./editSegment";

/** Segmentation method: "auto" (edit-first) | "edit" | "polygon". */
const SEGMENT_MODE = (process.env.GEMINI_SEGMENT_MODE || "auto").toLowerCase();

/**
 * Full server segmentation pipeline with a fallback ladder:
 *   1. image-edit + green mask (source: "gemini-edit")
 *   2. polygon JSON method (source: "gemini")
 *   3. deterministic mock (source: "mock")
 */
export async function segmentImage(buffer: Buffer): Promise<SegmentResult> {
  if (SEGMENT_MODE === "edit") {
    return segmentViaEdit(buffer);
  }
  if (SEGMENT_MODE === "polygon") {
    return segmentViaPolygon(buffer);
  }

  try {
    return await segmentViaEdit(buffer);
  } catch (error) {
    console.warn(
      "[segment] edit segmentation failed, falling back to polygon:",
      error instanceof Error ? error.message : error,
    );
    return segmentViaPolygon(buffer);
  }
}

/** Polygon-JSON segmentation (the original Gemini vision method). */
async function segmentViaPolygon(buffer: Buffer): Promise<SegmentResult> {
  const prepared = await prepareImage(buffer);

  let regions: WallRegion[];
  let source: SegmentResult["source"];

  try {
    regions = await detectWallRegions(prepared.geminiBase64, prepared.geminiMimeType);
    source = regions.length > 0 ? "gemini" : "empty";
  } catch (error) {
    console.warn(
      "[segment] polygon segmentation failed, falling back to mock:",
      error instanceof Error ? error.message : error,
    );
    regions = mockWallRegions(prepared.width, prepared.height);
    source = "mock";
  }

  const mask =
    regions.length > 0
      ? rasterizePolygons(regions.map((r) => r.polygon), prepared.width, prepared.height)
      : new Uint8Array(prepared.width * prepared.height);

  return { width: prepared.width, height: prepared.height, mask, source, regions };
}

/**
 * Convenience wrapper used by the API route: runs the pipeline and PNG-encodes
 * the resulting mask.
 */
export async function segmentImageToPng(buffer: Buffer): Promise<SegmentPng> {
  const result = await segmentImage(buffer);
  const png = await maskToPng(result.mask, result.width, result.height);
  return { png, width: result.width, height: result.height, source: result.source };
}
