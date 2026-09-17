import sharp from "sharp";

/** Longest edge (px) allowed for the image sent to Gemini. */
export const MAX_GEMINI_EDGE = 1024;

export interface PreparedImage {
  /** Original uploaded bytes. */
  buffer: Buffer;
  width: number;
  height: number;
  /** MIME type of the original upload. */
  mimeType: string;
  /** Base64 image to hand to Gemini (downscaled when the source is huge). */
  geminiBase64: string;
  geminiMimeType: string;
}

function mimeFromFormat(format: string | undefined): string {
  if (format === "png") return "image/png";
  if (format === "jpeg" || format === "jpg") return "image/jpeg";
  if (format === "webp") return "image/webp";
  return "image/jpeg";
}

/**
 * Read image metadata and produce the payload for the Gemini call. When the
 * source is large we downscale a *copy* for the model — wall polygons stay
 * normalized (0..1), so the final mask is still rasterized at full native
 * resolution.
 */
export async function prepareImage(buffer: Buffer): Promise<PreparedImage> {
  const metadata = await sharp(buffer).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  if (!width || !height) {
    throw new Error("Could not read image dimensions");
  }

  const mimeType = mimeFromFormat(metadata.format);

  let geminiBuffer = buffer;
  let geminiMimeType = mimeType;
  const maxEdge = Math.max(width, height);

  if (maxEdge > MAX_GEMINI_EDGE) {
    const scale = MAX_GEMINI_EDGE / maxEdge;
    geminiBuffer = await sharp(buffer)
      .resize({
        width: Math.max(1, Math.round(width * scale)),
        height: Math.max(1, Math.round(height * scale)),
        fit: "inside",
      })
      .jpeg({ quality: 82 })
      .toBuffer();
    geminiMimeType = "image/jpeg";
  }

  return {
    buffer,
    width,
    height,
    mimeType,
    geminiBase64: geminiBuffer.toString("base64"),
    geminiMimeType,
  };
}
