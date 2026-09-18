import { GoogleGenAI } from "@google/genai";

const DEFAULT_EDIT_MODEL = "gemini-3.1-flash-image";

/**
 * Proven prompt (validated empirically): the image model reliably repaints the
 * paintable walls a light green while leaving everything else untouched.
 */
const EDIT_PROMPT =
  "Make every wall of this house light green (shades of #00b140). " +
  "Keep everything else — furniture, cabinets, counters, floors, doors, windows, people, objects — exactly as it is.";

/** Structural shape of the parts of the image we need from the SDK response. */
interface ImageResponseLike {
  candidates?: Array<{
    content?: { parts?: Array<{ inlineData?: { data?: string } }> };
  }>;
  data?: string;
}

/**
 * Ask the Gemini image-editing model to recolor the walls light green and
 * return the edited image bytes. Throws when the key is missing, the call
 * fails, or no image is produced (the caller falls back to another method).
 */
export async function editWallsToGreen(imageBase64: string, mimeType: string): Promise<Buffer> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const ai = new GoogleGenAI({ apiKey });
  const model = process.env.GEMINI_EDIT_MODEL || DEFAULT_EDIT_MODEL;

  const response = (await ai.models.generateContent({
    model,
    contents: [
      {
        role: "user",
        parts: [
          { text: EDIT_PROMPT },
          { inlineData: { mimeType, data: imageBase64 } },
        ],
      },
    ],
    config: { responseModalities: ["IMAGE"] },
  })) as unknown as ImageResponseLike;

  const imageB64 = findImageData(response);
  if (!imageB64) {
    throw new Error("Image model returned no image");
  }
  return Buffer.from(imageB64, "base64");
}

function findImageData(response: ImageResponseLike): string | null {
  const parts = response?.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    if (part?.inlineData?.data) return part.inlineData.data;
  }
  if (typeof response?.data === "string" && response.data) return response.data;
  return null;
}
