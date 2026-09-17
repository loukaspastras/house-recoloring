/**
 * Non-blocking full-resolution export helpers.
 *
 * Exports use HTMLCanvasElement.toBlob (async, off the main thread) plus
 * URL.createObjectURL, so high-resolution photos never freeze the UI.
 */

/** Build the download filename from a hex color, e.g. `recolored-house-2a4d69.png`. */
export function buildExportFilename(colorHex: string): string {
  const normalized = colorHex.replace(/^#/, "");
  return `recolored-house-${normalized}.png`;
}

/** Wrap canvas.toBlob in a Promise so callers can `await` the export. */
export function exportCanvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Canvas toBlob returned null"));
        } else {
          resolve(blob);
        }
      },
      "image/png",
      1.0,
    );
  });
}

/** Programmatically trigger a browser download for a blob. */
export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = filename;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Export the canvas as a full-resolution PNG named after the selected color.
 * Uses toBlob + createObjectURL under the hood (see task spec).
 */
export async function exportImage(
  canvas: HTMLCanvasElement,
  colorHex: string,
): Promise<void> {
  const blob = await exportCanvasToBlob(canvas);
  triggerDownload(blob, buildExportFilename(colorHex));
}
