"use client";

/** POST the uploaded image to /api/segment and return the wall-mask PNG blob. */
export async function segmentImage(file: File): Promise<Blob> {
  const form = new FormData();
  form.append("image", file);

  const res = await fetch("/api/segment", { method: "POST", body: form });

  if (!res.ok) {
    let message = `Segmentation failed (${res.status})`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      // non-JSON error body; keep the generic message
    }
    throw new Error(message);
  }

  return res.blob();
}
