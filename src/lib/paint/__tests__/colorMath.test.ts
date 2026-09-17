import { hexToHsl, hexToRgb, hslToRgb, normalizeHex, rgbToHsl } from "../colorMath";

describe("hexToRgb", () => {
  it("parses 6-digit hex", () => {
    expect(hexToRgb("#2a4d69")).toEqual({ r: 42, g: 77, b: 105 });
    expect(hexToRgb("2a4d69")).toEqual({ r: 42, g: 77, b: 105 });
  });

  it("parses 3-digit hex", () => {
    expect(hexToRgb("#abc")).toEqual({ r: 170, g: 187, b: 204 });
  });

  it("rejects invalid input", () => {
    expect(() => hexToRgb("red")).toThrow();
    expect(() => hexToRgb("#12345")).toThrow();
    expect(() => hexToRgb("#gggggg")).toThrow();
  });
});

describe("normalizeHex", () => {
  it("lowercases and expands shorthand", () => {
    expect(normalizeHex("#ABC")).toBe("#aabbcc");
    expect(normalizeHex("2a4d69")).toBe("#2a4d69");
    expect(normalizeHex("#2A4D69")).toBe("#2a4d69");
  });
});

describe("rgbToHsl", () => {
  it("converts primaries", () => {
    expect(rgbToHsl({ r: 255, g: 0, b: 0 })).toEqual({ h: 0, s: 1, l: 0.5 });
    expect(rgbToHsl({ r: 0, g: 255, b: 0 })).toEqual({ h: 120, s: 1, l: 0.5 });
    expect(rgbToHsl({ r: 0, g: 0, b: 255 })).toEqual({ h: 240, s: 1, l: 0.5 });
  });

  it("handles achromatic colors", () => {
    expect(rgbToHsl({ r: 0, g: 0, b: 0 })).toEqual({ h: 0, s: 0, l: 0 });
    expect(rgbToHsl({ r: 255, g: 255, b: 255 })).toEqual({ h: 0, s: 0, l: 1 });
  });
});

describe("hslToRgb", () => {
  it("round-trips RGB → HSL → RGB within rounding", () => {
    const samples = [
      { r: 200, g: 120, b: 40 },
      { r: 42, g: 77, b: 105 },
      { r: 240, g: 240, b: 240 },
      { r: 10, g: 200, b: 150 },
    ];
    for (const rgb of samples) {
      const round = hslToRgb(rgbToHsl(rgb));
      expect(Math.abs(round.r - rgb.r)).toBeLessThanOrEqual(2);
      expect(Math.abs(round.g - rgb.g)).toBeLessThanOrEqual(2);
      expect(Math.abs(round.b - rgb.b)).toBeLessThanOrEqual(2);
    }
  });

  it("converts a known hue/saturation", () => {
    expect(hexToHsl("#ff0000")).toEqual({ h: 0, s: 1, l: 0.5 });
  });
});
