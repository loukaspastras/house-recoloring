import type { SegmentPng, SegmentResult, WallRegion } from "./types";
import { rasterizePolygons } from "./rasterize";
import { prepareImage } from "./imageMeta";
import { detectWallRegions } from "./gemini";
import { mockWallRegions } from "./mock";
import { maskToPng } from "./maskPng";

/**
 * Full server segmentation pipeline:
 *  1. decode image metadata (downscaling a copy for Gemini if necessary)
 *  2. call Gemini Vision once for wall polygons (mock fallback on failure)
 *  3. rasterize polygons into a binary mask at full native resolution
 */
export async function segmentImage(buffer: Buffer): Promise<SegmentResult> {
  const prepared = await prepareImage(buffer);

  let regions: WallRegion[];
  let source: SegmentResult["source"];

  try {
    regions = await detectWallRegions(prepared.geminiBase64, prepared.geminiMimeType);
    source = regions.length > 0 ? "gemini" : "empty";
  } catch (error) {
    console.warn(
      "[segment] Gemini segmentation failed, falling back to mock:",
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
