/**
 * Green-pixel mask extraction.
 *
 * The image-editing model is asked to repaint walls a light green; this module
 * turns that into a binary mask by flagging pixels that are *green-dominant*
 * (green clearly above both red and blue). It is deliberately independent of
 * any comparison to the original photo, which makes it robust to the global
 * tone/white-balance shift the model injects (that shift affects neutrals, not
 * relative greenness).
 */

export interface GreenMaskOptions {
  /** Minimum green dominance: g - max(r, b). Pixels must be at least this green. */
  margin?: number;
  /** Minimum lightness (0..1) to ignore near-black noise. */
  minLightness?: number;
}

export const DEFAULT_GREEN_MARGIN = 15;
export const DEFAULT_MIN_LIGHTNESS = 0.05;

/**
 * Build a binary mask (0/255) where 255 = green-dominant pixel. `rgba` is a
 * flat RGBA byte buffer of `width * height * 4` bytes.
 */
export function computeGreenMask(
  rgba: Uint8Array,
  width: number,
  height: number,
  options: GreenMaskOptions = {},
): Uint8Array {
  const margin = options.margin ?? DEFAULT_GREEN_MARGIN;
  const minLightness = options.minLightness ?? DEFAULT_MIN_LIGHTNESS;
  const pixelCount = width * height;
  const mask = new Uint8Array(pixelCount);

  for (let i = 0; i < pixelCount; i++) {
    const p = i * 4;
    const r = rgba[p];
    const g = rgba[p + 1];
    const b = rgba[p + 2];

    const max = r > g ? (r > b ? r : b) : g > b ? g : b;
    const min = r < g ? (r < b ? r : b) : g < b ? g : b;
    const maxRB = r > b ? r : b;
    const lightness = (max + min) / 510;

    if (g - maxRB >= margin && lightness >= minLightness) {
      mask[i] = 255;
    }
  }

  return mask;
}
