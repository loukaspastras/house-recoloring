/** @jest-environment node */

import { parseWalls } from "../gemini";

describe("parseWalls", () => {
  it("parses a direct JSON object with a walls array", () => {
    const regions = parseWalls(
      JSON.stringify({
        walls: [{ label: "front wall", polygon: [[0, 0], [1, 0], [1, 1]] }],
      }),
    );
    expect(regions).toHaveLength(1);
    expect(regions[0].label).toBe("front wall");
    expect(regions[0].polygon).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ]);
  });

  it("parses a bare array form", () => {
    const regions = parseWalls(JSON.stringify([{ polygon: [[0, 0], [1, 0], [1, 1]] }]));
    expect(regions).toHaveLength(1);
    expect(regions[0].label).toBe("wall"); // default label
  });

  it("parses fenced markdown JSON", () => {
    const regions = parseWalls(
      '```json\n{"walls":[{"label":"side","polygon":[[0,0],[1,0],[1,1]]}]}\n```',
    );
    expect(regions).toHaveLength(1);
    expect(regions[0].label).toBe("side");
  });

  it("parses JSON embedded in prose", () => {
    const regions = parseWalls(
      'Here you go: {"walls":[{"polygon":[[0,0],[1,0],[1,1]]}]} thanks!',
    );
    expect(regions).toHaveLength(1);
  });

  it("clamps out-of-range coordinates to [0,1]", () => {
    const regions = parseWalls(
      JSON.stringify({ walls: [{ polygon: [[1.5, -0.2], [0, 0], [1, 1]] }] }),
    );
    expect(regions[0].polygon[0]).toEqual({ x: 1, y: 0 });
  });

  it("drops polygons with fewer than 3 valid points", () => {
    const regions = parseWalls(
      JSON.stringify({
        walls: [
          { polygon: [[0, 0], [1, 1]] },
          { polygon: [[0, 0], [1, 0], [1, 1]] },
        ],
      }),
    );
    expect(regions).toHaveLength(1);
  });

  it("skips non-finite vertices", () => {
    const regions = parseWalls(
      JSON.stringify({
        walls: [{ polygon: [[0, 0], ["a", 1], [1, 0], [1, 1]] }],
      }),
    );
    expect(regions[0].polygon).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ]);
  });

  it("throws for non-JSON, non-walls payloads", () => {
    expect(() => parseWalls("not json at all")).toThrow();
    expect(() => parseWalls(JSON.stringify({ nope: [] }))).toThrow();
  });
});
