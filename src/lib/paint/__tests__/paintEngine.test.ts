import {
  applyBrushStamp,
  applyRecolor,
  buildCombinedMask,
  buildLightnessLut,
  computeLightness,
  REFINE_NEUTRAL,
} from "../paintEngine";
import { rgbToHsl } from "../colorMath";

function pixelLightness(data: Uint8ClampedArray, i: number): number {
  return rgbToHsl({ r: data[i * 4], g: data[i * 4 + 1], b: data[i * 4 + 2] }).l;
}

describe("computeLightness", () => {
  it("stores max+min of each pixel", () => {
    const data = new Uint8ClampedArray([128, 128, 128, 255, 10, 200, 50, 255, 255, 0, 0, 255]);
    const lightness = computeLightness(data);
    expect(lightness[0]).toBe(256); // 128 + 128
    expect(lightness[1]).toBe(210); // 200 + 10
    expect(lightness[2]).toBe(255); // 255 + 0
  });
});

describe("buildLightnessLut", () => {
  it("produces 511 packed entries with correct endpoints", () => {
    const lut = buildLightnessLut(0, 1); // pure red
    expect(lut.length).toBe(511);
    // Lightness 0 → black (alpha 0xFF)
    expect(lut[0]).toBe(0xff000000);
    // Lightness 1.0 → white
    expect(lut[510]).toBe(0xffffffff);
  });
});

describe("applyRecolor", () => {
  const width = 4;
  const height = 4;
  const n = width * height;

  function makeBase(): Uint8ClampedArray {
    const base = new Uint8ClampedArray(n * 4);
    for (let i = 0; i < n; i++) {
      base[i * 4] = 120;
      base[i * 4 + 1] = 130;
      base[i * 4 + 2] = 150;
      base[i * 4 + 3] = 255;
    }
    return base;
  }

  it("preserves the original lightness channel after a recolor", () => {
    const base = makeBase();
    const lightness = computeLightness(base);
    const mask = new Uint8Array(n).fill(255); // all wall
    const lut = buildLightnessLut(0, 1); // pure red
    const out = new Uint8ClampedArray(n * 4);

    applyRecolor(out, base, lightness, mask, lut, width, height);

    for (let i = 0; i < n; i++) {
      const before = pixelLightness(base, i);
      const after = pixelLightness(out, i);
      expect(Math.abs(after - before)).toBeLessThan(0.01);
    }
    // The recolored wall is now strongly red.
    expect(out[0]).toBeGreaterThan(out[2]);
  });

  it("leaves non-wall pixels byte-identical", () => {
    const base = makeBase();
    const lightness = computeLightness(base);
    const mask = new Uint8Array(n); // all non-wall
    const lut = buildLightnessLut(200, 0.8);
    const out = new Uint8ClampedArray(n * 4);

    applyRecolor(out, base, lightness, mask, lut, width, height);
    expect(out).toEqual(base);
  });

  it("only updates the requested region", () => {
    const base = makeBase();
    const lightness = computeLightness(base);
    const mask = new Uint8Array(n).fill(255);
    const out = new Uint8ClampedArray(n * 4);

    // A full render establishes the baseline composite.
    applyRecolor(out, base, lightness, mask, buildLightnessLut(200, 0.8), width, height);
    const snapshot = new Uint8ClampedArray(out);

    // A second color applied only to the center region.
    applyRecolor(out, base, lightness, mask, buildLightnessLut(0, 1), width, height, {
      x0: 1,
      y0: 1,
      x1: 2,
      y1: 2,
    });

    // Top-left corner (outside region) unchanged from baseline.
    expect([out[0], out[1], out[2]]).toEqual([snapshot[0], snapshot[1], snapshot[2]]);
    // Center pixel (inside region) recolored.
    const center = (1 * width + 1) * 4;
    expect([out[center], out[center + 1], out[center + 2]]).not.toEqual([
      snapshot[center],
      snapshot[center + 1],
      snapshot[center + 2],
    ]);
  });

  it("blends toward the original as opacity decreases", () => {
    const base = makeBase();
    const lightness = computeLightness(base);
    const mask = new Uint8Array(n).fill(255);
    const lut = buildLightnessLut(0, 1);
    const half = new Uint8ClampedArray(n * 4);
    const full = new Uint8ClampedArray(n * 4);

    applyRecolor(half, base, lightness, mask, lut, width, height, undefined, 0.5);
    applyRecolor(full, base, lightness, mask, lut, width, height, undefined, 1);

    // At 50% opacity the red channel sits between base and full.
    expect(half[0]).toBeGreaterThan(base[0]);
    expect(half[0]).toBeLessThan(full[0]);
  });
});

describe("buildCombinedMask", () => {
  it("uses AI mask for neutral refinement and overrides otherwise", () => {
    const aiMask = new Uint8Array([255, 0, 255, 0]);
    const refine = new Uint8Array([REFINE_NEUTRAL, REFINE_NEUTRAL, 200, 60]);
    const out = new Uint8Array(4);
    buildCombinedMask(aiMask, refine, out);
    expect([...out]).toEqual([255, 0, 200, 60]);
  });
});

describe("applyBrushStamp", () => {
  const width = 8;
  const height = 8;
  const n = width * height;

  it("add mode strengthens wall coverage near the center", () => {
    const aiMask = new Uint8Array(n); // nothing detected
    const refine = new Uint8Array(n).fill(REFINE_NEUTRAL);
    const combined = new Uint8Array(n);
    buildCombinedMask(aiMask, refine, combined);

    const bbox = applyBrushStamp(refine, combined, aiMask, width, height, 4, 4, 2, 1, "add");

    expect(bbox).toEqual({ x0: 2, y0: 2, x1: 6, y1: 6 });
    const center = 4 * width + 4;
    expect(refine[center]).toBeGreaterThan(REFINE_NEUTRAL);
    expect(combined[center]).toBeGreaterThan(REFINE_NEUTRAL);
    // Far corner unaffected.
    expect(refine[0]).toBe(REFINE_NEUTRAL);
  });

  it("erase mode removes wall coverage near the center", () => {
    const aiMask = new Uint8Array(n).fill(255); // full wall
    const refine = new Uint8Array(n).fill(REFINE_NEUTRAL);
    const combined = new Uint8Array(n);
    buildCombinedMask(aiMask, refine, combined);

    applyBrushStamp(refine, combined, aiMask, width, height, 4, 4, 2, 0.5, "erase");

    const center = 4 * width + 4;
    expect(refine[center]).toBeLessThan(REFINE_NEUTRAL);
    expect(combined[center]).toBe(0);
    // Outside the stamp the AI mask still applies.
    expect(combined[0]).toBe(255);
  });
});

describe("recolor performance", () => {
  it("swaps a full 1080p frame in under 16ms", () => {
    const W = 1920;
    const H = 1080;
    const n = W * H;
    const base = new Uint8ClampedArray(n * 4);
    for (let i = 0; i < n * 4; i += 4) {
      base[i] = 128;
      base[i + 1] = 140;
      base[i + 2] = 160;
      base[i + 3] = 255;
    }
    const lightness = computeLightness(base);
    const mask = new Uint8Array(n).fill(255); // worst case: entire frame is wall
    const lut = buildLightnessLut(210, 0.5);
    const out = new Uint8ClampedArray(n * 4);

    // Warm up the JIT before measuring.
    applyRecolor(out, base, lightness, mask, lut, W, H);

    const runs = 5;
    let totalMs = 0;
    for (let r = 0; r < runs; r++) {
      const start = performance.now();
      applyRecolor(out, base, lightness, mask, lut, W, H);
      totalMs += performance.now() - start;
    }
    const averageMs = totalMs / runs;
    expect(averageMs).toBeLessThan(16);
  });
});
