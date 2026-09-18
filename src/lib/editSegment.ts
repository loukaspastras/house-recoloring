import sharp from "sharp";
import type { SegmentResult } from "./types";
import { prepareImage } from "./imageMeta";
import { editWallsToGreen } from "./geminiEdit";
import { computeGreenMask, DEFAULT_GREEN_MARGIN } from "./greenMask";

/**
 * Segmentation via the image-editing model:
 *  1. edit the photo → walls repainted light green
 *  2. upscale the edited image to the original native resolution
 *  3. flag green-dominant pixels → binary mask
 *
 * The mask is then applied to the ORIGINAL image by the client, so lightness
 * and full native resolution are preserved. Green detection is done at full
 * resolution on the (RGBA) edited image — resizing raw 1-channel buffers with
 * sharp is avoided entirely (it produces scanline artifacts).
 */
export async function segmentViaEdit(buffer: Buffer): Promise<SegmentResult> {
  const prepared = await prepareImage(buffer);

  const edited = await editWallsToGreen(prepared.geminiBase64, prepared.geminiMimeType);

  const { data: editedRgba } = await sharp(edited)
    .removeAlpha()
    .ensureAlpha()
    .resize(prepared.width, prepared.height, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const mask = computeGreenMask(editedRgba, prepared.width, prepared.height, {
    margin: DEFAULT_GREEN_MARGIN,
  });

  return {
    width: prepared.width,
    height: prepared.height,
    mask,
    source: "gemini-edit",
    regions: [],
  };
}
