/** @jest-environment node */

import {
  clamp,
  denormalizePolygons,
  fillPolygon,
  rasterizePolygons,
} from "../rasterize";

function countWhite(mask: Uint8Array): number {
  let n = 0;
  for (let i = 0; i < mask.length; i++) if (mask[i] === 255) n++;
  return n;
}

describe("clamp", () => {
  it("clamps into range", () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-5, 0, 1)).toBe(0);
    expect(clamp(0.5, 0, 1)).toBe(0.5);
  });
});

describe("denormalizePolygons", () => {
  it("scales normalized coords to pixel space and clamps", () => {
    const result = denormalizePolygons(
      [[{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: -1 }]],
      10,
      10,
    );
    expect(result[0][0]).toEqual({ x: 0, y: 0 });
    expect(result[0][1]).toEqual({ x: 10, y: 10 });
    expect(result[0][2]).toEqual({ x: 10, y: 0 });
  });
});

describe("rasterizePolygons", () => {
  it("fills the whole image for a full-frame polygon", () => {
    const mask = rasterizePolygons(
      [[{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }]],
      8,
      8,
    );
    expect(countWhite(mask)).toBe(64);
  });

  it("fills a centered square with the expected pixel count", () => {
    const mask = rasterizePolygons(
      [[{ x: 0.25, y: 0.25 }, { x: 0.75, y: 0.25 }, { x: 0.75, y: 0.75 }, { x: 0.25, y: 0.75 }]],
      8,
      8,
    );
    expect(countWhite(mask)).toBe(16);
  });

  it("returns an all-black mask for no polygons", () => {
    const mask = rasterizePolygons([], 8, 8);
    expect(countWhite(mask)).toBe(0);
  });
});

describe("fillPolygon", () => {
  it("ignores polygons with fewer than 3 points", () => {
    const mask = new Uint8Array(25);
    fillPolygon(mask, 5, 5, [{ x: 0, y: 0 }, { x: 4, y: 4 }]);
    expect(countWhite(mask)).toBe(0);
  });

  it("fills a concave L-shape with the correct cells", () => {
    const mask = new Uint8Array(25);
    const lShape = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 1 },
      { x: 1, y: 1 },
      { x: 1, y: 4 },
      { x: 0, y: 4 },
    ];
    fillPolygon(mask, 5, 5, lShape);
    // Top bar (4×1) + left bar (1×3) = 7 cells.
    expect(countWhite(mask)).toBe(7);
    expect(mask[0 * 5 + 3]).toBe(255); // rightmost top-bar cell
    expect(mask[3 * 5 + 0]).toBe(255); // bottom of left bar
    expect(mask[1 * 5 + 3]).toBe(0); // notch (not part of L)
    expect(mask[0 * 5 + 4]).toBe(0); // just outside the top bar
  });

  it("fills a self-intersecting bowtie using the even-odd rule", () => {
    const mask = new Uint8Array(25);
    const bowtie = [
      { x: 0, y: 0 },
      { x: 4, y: 4 },
      { x: 0, y: 4 },
      { x: 4, y: 0 },
    ];
    fillPolygon(mask, 5, 5, bowtie);
    // Hourglass lobes: rows 0 & 3 fill x=0..3, rows 1 & 2 fill x=1..2.
    expect(countWhite(mask)).toBe(12);
    expect(mask[0 * 5 + 0]).toBe(255); // top-left lobe
    expect(mask[2 * 5 + 1]).toBe(255); // inner lobe cell
    expect(mask[0 * 5 + 4]).toBe(0); // top-right corner (outside)
    expect(mask[4 * 5 + 0]).toBe(0); // bottom row (outside)
  });
});
