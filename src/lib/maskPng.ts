import sharp from "sharp";

/**
 * Encode a binary mask (0/255) as a PNG. Grayscale raw input keeps the file
 * tiny while remaining fully compatible with browser `<img>` loading.
 */
export async function maskToPng(
  mask: Uint8Array,
  width: number,
  height: number,
): Promise<Buffer> {
  const raw = Buffer.from(mask.buffer, mask.byteOffset, mask.byteLength);
  return sharp(raw, { raw: { width, height, channels: 1 } })
    .png()
    .toBuffer();
}

/**
 * Decode a mask PNG back into a binary mask. Used by tests and utilities to
 * round-trip masks produced by `maskToPng`.
 */
export async function pngToMask(
  buffer: Buffer,
): Promise<{ mask: Uint8Array; width: number; height: number }> {
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const mask = new Uint8Array(width * height);

  for (let i = 0; i < width * height; i++) {
    // The mask is grayscale; any channel holds the value. Threshold to binary.
    mask[i] = data[i * channels] >= 128 ? 255 : 0;
  }

  return { mask, width, height };
}
