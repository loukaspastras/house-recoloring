/**
 * Pixel-level compositing engine. Everything here operates on plain typed
 * arrays so it is fully unit-testable (and benchmarkable) outside the DOM.
 *
 * Core idea (Lightness-LUT recolor):
 *  1. Precompute per-pixel lightness once: `L = (max + min) / 2` of the RGB
 *     channels. Because max+min is an integer in [0, 510], storing that sum
 *     preserves the exact 8-bit HSL lightness of every pixel.
 *  2. On a color change, build a 511-entry lookup table that maps lightness →
 *     the target color's RGB (same L, new H & S). Swapping a color is then a
 *     single pass of LUT lookups — no per-pixel trigonometry — which keeps
 *     swaps comfortably inside a 16 ms frame budget.
 *  3. A binary wall mask gates which pixels are recolored; a soft brush mask
 *     (0-255) allows anti-aliased brush edges via alpha blending.
 *
 * The hot loop writes packed 32-bit RGBA words (little-endian, the native
 * layout of `<canvas>`/ImageData on every mainstream platform) for a ~2x speed
 * win over four separate byte writes.
 */
import { hslToRgb } from "./colorMath";

/** Number of distinct lightness levels: max+min ∈ [0, 510]. */
export const LIGHTNESS_LEVELS = 511;

export type BrushMode = "add" | "erase";

/** Neutral value of the refinement mask (defer to the AI mask). */
export const REFINE_NEUTRAL = 128;

export interface Region {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Pack RGBA channels into a little-endian 32-bit word (a<<24 | b<<16 | g<<8 | r). */
export function packRgba(r: number, g: number, b: number, a: number): number {
  return ((a & 0xff) << 24) | ((b & 0xff) << 16) | ((g & 0xff) << 8) | (r & 0xff);
}

/**
 * Precompute the exact lightness index (max+min, 0..510) of every pixel in an
 * RGBA buffer.
 */
export function computeLightness(data: Uint8ClampedArray): Uint16Array {
  const pixelCount = data.length >> 2;
  const lightness = new Uint16Array(pixelCount);

  for (let i = 0, p = 0; i < pixelCount; i++, p += 4) {
    const r = data[p];
    const g = data[p + 1];
    const b = data[p + 2];
    const max = r > g ? (r > b ? r : b) : g > b ? g : b;
    const min = r < g ? (r < b ? r : b) : g < b ? g : b;
    lightness[i] = max + min;
  }

  return lightness;
}

/**
 * Build the 511-entry packed-RGB lookup table for a target hue and saturation.
 * Entry `L` holds the color for lightness `L / 510` (alpha fixed at 0xFF).
 */
export function buildLightnessLut(hue: number, saturation: number): Uint32Array {
  const lut = new Uint32Array(LIGHTNESS_LEVELS);
  for (let l = 0; l < LIGHTNESS_LEVELS; l++) {
    const { r, g, b } = hslToRgb({ h: hue, s: saturation, l: l / 510 });
    lut[l] = packRgba(r, g, b, 255);
  }
  return lut;
}

/**
 * Recolor wall pixels by replacing hue/saturation while preserving lightness.
 *
 * - `out` receives the result (a full RGBA buffer of `width * height` pixels).
 * - `mask` is the combined wall mask (0-255; 255 = fully wall).
 * - `lut` is the target-color LUT from {@link buildLightnessLut}.
 * - `region` limits work to a sub-rectangle (brush updates); omit for full frame.
 * - `opacity` is a global 0..1 multiplier on the recolor strength.
 */
export function applyRecolor(
  out: Uint8ClampedArray,
  base: Uint8ClampedArray,
  lightness: Uint16Array,
  mask: Uint8Array,
  lut: Uint32Array,
  width: number,
  height: number,
  region?: Region,
  opacity = 1,
): void {
  const x0 = region ? Math.max(0, region.x0 | 0) : 0;
  const y0 = region ? Math.max(0, region.y0 | 0) : 0;
  const x1 = region ? Math.min(width - 1, region.x1 | 0) : width - 1;
  const y1 = region ? Math.min(height - 1, region.y1 | 0) : height - 1;
  const opaque = opacity >= 1;

  const pixelCount = width * height;
  const out32 = new Uint32Array(out.buffer, out.byteOffset, pixelCount);
  const base32 = new Uint32Array(base.buffer, base.byteOffset, pixelCount);

  for (let y = y0; y <= y1; y++) {
    const rowStart = y * width;

    for (let x = x0; x <= x1; x++) {
      const i = rowStart + x;
      const m = mask[i];

      if (m === 0) {
        out32[i] = base32[i];
        continue;
      }

      if (m === 255 && opaque) {
        // Fast path: keep the source alpha, replace RGB from the LUT.
        out32[i] = (lut[lightness[i]] & 0x00ffffff) | (base32[i] & 0xff000000);
        continue;
      }

      const packed = lut[lightness[i]];
      const r = packed & 0xff;
      const g = (packed >> 8) & 0xff;
      const b = (packed >> 16) & 0xff;
      const alpha = m === 255 ? opacity : (m / 255) * opacity;

      if (alpha <= 0) {
        out32[i] = base32[i];
        continue;
      }

      const p = i * 4;
      const inv = 1 - alpha;
      out32[i] = packRgba(
        Math.round(base[p] * inv + r * alpha),
        Math.round(base[p + 1] * inv + g * alpha),
        Math.round(base[p + 2] * inv + b * alpha),
        base[p + 3],
      );
    }
  }
}

/**
 * Derive the combined mask from the binary AI mask and the brush refinement
 * mask. Refinement value 128 means "no opinion" (use the AI mask); anything
 * else overrides (add → >128, erase → <128).
 */
export function buildCombinedMask(
  aiMask: Uint8Array,
  refine: Uint8Array,
  out: Uint8Array,
): void {
  for (let i = 0; i < aiMask.length; i++) {
    const r = refine[i];
    out[i] = r === REFINE_NEUTRAL ? aiMask[i] : r;
  }
}

/**
 * Stamp a soft circular brush into the refinement mask (and update the
 * combined mask in place). Returns the dirty bounding box for a partial
 * recomposite, or null if the stamp fell outside the canvas.
 */
export function applyBrushStamp(
  refine: Uint8Array,
  combined: Uint8Array,
  aiMask: Uint8Array,
  width: number,
  height: number,
  cx: number,
  cy: number,
  radius: number,
  hardness: number,
  mode: BrushMode,
): Region | null {
  if (!(radius > 0)) return null;

  const extent = Math.ceil(radius);
  const x0 = Math.max(0, Math.floor(cx - extent));
  const x1 = Math.min(width - 1, Math.ceil(cx + extent));
  const y0 = Math.max(0, Math.floor(cy - extent));
  const y1 = Math.min(height - 1, Math.ceil(cy + extent));
  if (x0 > x1 || y0 > y1) return null;

  const hardnessCurve = hardness * 8 + 1;

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance > radius) continue;

      const falloff = 1 - distance / radius; // 1 at center, 0 at edge
      const strength = Math.pow(falloff, hardnessCurve);
      const idx = y * width + x;

      if (mode === "add") {
        const value = Math.round(REFINE_NEUTRAL + 127 * strength);
        if (value > refine[idx]) refine[idx] = value;
      } else {
        const value = Math.round(REFINE_NEUTRAL - 128 * strength);
        if (value < refine[idx]) refine[idx] = value;
      }

      const r = refine[idx];
      combined[idx] = r === REFINE_NEUTRAL ? aiMask[idx] : r;
    }
  }

  return { x0, y0, x1, y1 };
}
