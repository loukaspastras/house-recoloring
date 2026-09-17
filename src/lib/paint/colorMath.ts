/**
 * Pure color-math helpers shared by the compositing engine and UI.
 * All functions are side-effect free and fully unit-tested.
 */

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface HSL {
  /** Hue in degrees [0, 360). */
  h: number;
  /** Saturation in [0, 1]. */
  s: number;
  /** Lightness in [0, 1]. */
  l: number;
}

const HEX6 = /^[0-9a-fA-F]{6}$/;

/** Parse a "#rrggbb" / "#rgb" / "rrggbb" string into 0-255 channels. */
export function hexToRgb(hex: string): RGB {
  let value = hex.trim().replace(/^#/, "");
  if (value.length === 3) {
    value = value
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (!HEX6.test(value)) {
    throw new Error(`Invalid hex color: "${hex}"`);
  }
  const n = parseInt(value, 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

/** Standard RGB → HSL conversion (channels in 0-255, HSL as above). */
export function rgbToHsl({ r, g, b }: RGB): HSL {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;

  if (max === min) {
    return { h: 0, s: 0, l };
  }

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h: number;
  if (max === rn) {
    h = (gn - bn) / d + (gn < bn ? 6 : 0);
  } else if (max === gn) {
    h = (bn - rn) / d + 2;
  } else {
    h = (rn - gn) / d + 4;
  }

  return { h: h * 60, s, l };
}

/** Standard HSL → RGB conversion. */
export function hslToRgb({ h, s, l }: HSL): RGB {
  const hh = (((h % 360) + 360) % 360) / 360;

  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  return {
    r: Math.round(hueToRgb(p, q, hh + 1 / 3) * 255),
    g: Math.round(hueToRgb(p, q, hh) * 255),
    b: Math.round(hueToRgb(p, q, hh - 1 / 3) * 255),
  };
}

function hueToRgb(p: number, q: number, t: number): number {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

export function hexToHsl(hex: string): HSL {
  return rgbToHsl(hexToRgb(hex));
}

/** Normalize any valid hex string to lowercase "#rrggbb". */
export function normalizeHex(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  const to2 = (v: number) => v.toString(16).padStart(2, "0");
  return `#${to2(r)}${to2(g)}${to2(b)}`;
}
