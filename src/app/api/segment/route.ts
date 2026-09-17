import { segmentImageToPng } from "@/lib/segment";

export const runtime = "nodejs";

const MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png"]);

/**
 * POST /api/segment
 *
 * Accepts a multipart/form-data upload with an "image" file (JPEG/PNG, ≤15 MB)
 * and returns a binary mask PNG where white = paintable walls, black = other.
 * A single Gemini Vision call identifies wall polygons; when the key is absent
 * or the call fails, a deterministic mock mask is returned instead (flagged via
 * the X-Mask-Source header).
 */
export async function POST(request: Request): Promise<Response> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    return json({ error: "Expected multipart/form-data request body" }, 400);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: "Could not parse form data" }, 400);
  }

  const file = form.get("image");
  if (!isFileLike(file)) {
    return json({ error: "Missing 'image' file in form data" }, 400);
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return json({ error: "Unsupported image type. Upload a JPEG or PNG." }, 400);
  }
  if (file.size === 0) {
    return json({ error: "Uploaded image is empty" }, 400);
  }
  if (file.size > MAX_BYTES) {
    return json({ error: "Image exceeds the 15 MB limit" }, 413);
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const result = await segmentImageToPng(buffer);
    return new Response(new Uint8Array(result.png), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": 'inline; filename="wall-mask.png"',
        "X-Mask-Source": result.source,
        "X-Mask-Width": String(result.width),
        "X-Mask-Height": String(result.height),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[segment] segmentation failed:", error);
    return json({ error: "Segmentation failed" }, 500);
  }
}

function json(body: unknown, status: number): Response {
  return Response.json(body, { status });
}

/** Duck-typed File check, robust across Node/undici/jsdom runtimes. */
function isFileLike(value: unknown): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    "arrayBuffer" in value &&
    "size" in value &&
    "type" in value
  );
}
