/** @jest-environment node */

import { computeGreenMask, DEFAULT_GREEN_MARGIN } from "../greenMask";

function px(...vals: number[]): Uint8Array {
  return new Uint8Array(vals);
}

describe("computeGreenMask", () => {
  it("flags green-dominant pixels", () => {
    // 2 pixels: pure green, pure red
    const rgba = px(
      0, 255, 0, 255, // green -> wall
      255, 0, 0, 255, // red -> not wall
    );
    const mask = computeGreenMask(rgba, 2, 1);
    expect(mask[0]).toBe(255);
    expect(mask[1]).toBe(0);
  });

  it("excludes pixels that are only slightly green (below margin)", () => {
    // g - max(r,b) = 5 < default margin 15
    const rgba = px(120, 125, 120, 255);
    const mask = computeGreenMask(rgba, 1, 1);
    expect(mask[0]).toBe(0);
  });

  it("respects a custom margin", () => {
    const rgba = px(120, 130, 120, 255); // g - max(r,b) = 10
    expect(computeGreenMask(rgba, 1, 1, { margin: 15 })[0]).toBe(0);
    expect(computeGreenMask(rgba, 1, 1, { margin: 10 })[0]).toBe(255);
  });

  it("excludes near-black pixels regardless of greenness", () => {
    // dark green (5, 20, 5) -> lightness ~0.05, on the boundary of exclusion
    const rgba = px(5, 20, 5, 255);
    const mask = computeGreenMask(rgba, 1, 1);
    expect(mask[0]).toBe(0);
  });

  it("uses DEFAULT_GREEN_MARGIN when no options are passed", () => {
    expect(DEFAULT_GREEN_MARGIN).toBe(15);
  });
});
