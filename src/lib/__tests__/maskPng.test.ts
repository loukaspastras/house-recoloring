/** @jest-environment node */

import { maskToPng, pngToMask } from "../maskPng";

describe("mask PNG round-trip", () => {
  it("encodes and decodes a binary mask losslessly", async () => {
    const width = 16;
    const height = 8;
    const mask = new Uint8Array(width * height);

    // Left half white, right half black.
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        mask[y * width + x] = x < width / 2 ? 255 : 0;
      }
    }

    const png = await maskToPng(mask, width, height);
    expect(Buffer.isBuffer(png)).toBe(true);
    expect(png.length).toBeGreaterThan(8);

    const decoded = await pngToMask(png);
    expect(decoded.width).toBe(width);
    expect(decoded.height).toBe(height);
    expect(decoded.mask).toEqual(mask);
  });

  it("produces a valid PNG signature", async () => {
    const png = await maskToPng(new Uint8Array(4), 2, 2);
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  });
});
