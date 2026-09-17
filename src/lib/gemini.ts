import { GoogleGenAI, Type } from "@google/genai";
import type { Point, WallRegion } from "./types";
import { clamp } from "./rasterize";

const DEFAULT_MODEL = "gemini-3.6-flash";

/** Max number of wall regions to accept from the model. */
const MAX_REGIONS = 24;
/** Max vertices retained per region (safety against runaway output). */
const MAX_VERTICES = 64;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    walls: {
      type: Type.ARRAY,
      description:
        "Polygons outlining every paintable wall / exterior siding region found in the image.",
      items: {
        type: Type.OBJECT,
        properties: {
          label: {
            type: Type.STRING,
            description: "A short label for the region, e.g. 'front wall'.",
          },
          polygon: {
            type: Type.ARRAY,
            description:
              "Ordered vertices of the region. Each vertex is [x, y] in normalized image coordinates (0.0 to 1.0).",
            items: {
              type: Type.ARRAY,
              description: "A single vertex as an array of exactly two numbers: [x, y].",
              items: { type: Type.NUMBER },
            },
          },
        },
        required: ["label", "polygon"],
        propertyOrdering: ["label", "polygon"],
      },
    },
  },
  required: ["walls"],
  propertyOrdering: ["walls"],
};

const PROMPT = `You are an expert exterior-architecture image analyst.

Analyze the provided photograph of a house/building and identify the regions that a
homeowner would want to repaint: exterior walls and siding only.

STRICT RULES
- Include ONLY exterior wall / siding surfaces (stucco, brick, wood, vinyl, concrete,
  painted panels, cladding). Keep them as the LARGEST contiguous regions you can
  confidently outline.
- EXCLUDE windows, glass, doors, garage doors, roofs, gutters, trim, fascia, shutters,
  columns, porches' ceilings, vegetation, sky, ground, driveways, and people/objects.
- Return every distinct wall plane you can see (front, side, gable, upper/lower bands).
- Represent each region as ONE polygon using ordered vertices that tightly hug its
  visible outline.

OUTPUT
Return JSON with a "walls" array. Each item has a "label" and a "polygon": an ordered
list of [x, y] vertices where x and y are NORMALIZED image coordinates in the range
0.0 to 1.0 (0,0 = top-left corner, 1,1 = bottom-right corner). Use between 3 and 16
vertices per region.`;

/**
 * Call the Gemini Vision API once to detect paintable wall regions, returned as
 * normalized polygons. Throws when the key is missing or the call fails — the
 * caller is responsible for falling back to a mock segmenter.
 */
export async function detectWallRegions(
  imageBase64: string,
  mimeType: string,
): Promise<WallRegion[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const ai = new GoogleGenAI({ apiKey });
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        role: "user",
        parts: [
          { text: PROMPT },
          { inlineData: { mimeType, data: imageBase64 } },
        ],
      },
    ],
    config: {
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      maxOutputTokens: 8192,
    },
  });

  const text = response?.text;
  if (!text) {
    throw new Error("Gemini returned an empty response");
  }

  return parseWalls(text);
}

/**
 * Robustly parse the model output. The SDK is asked for application/json but we
 * defensively handle fenced or embedded JSON as well.
 */
export function parseWalls(text: string): WallRegion[] {
  let data: unknown;

  try {
    data = JSON.parse(text);
  } catch {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenced) {
      data = JSON.parse(fenced[1]);
    } else {
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      if (start === -1 || end <= start) {
        throw new Error("Gemini response did not contain JSON");
      }
      data = JSON.parse(text.slice(start, end + 1));
    }
  }

  const raw = Array.isArray(data)
    ? data
    : (data as { walls?: unknown[] } | null | undefined)?.walls;

  if (!Array.isArray(raw)) {
    throw new Error("Gemini response did not contain a 'walls' array");
  }

  return normalizeRegions(raw);
}

function normalizeRegions(raw: unknown[]): WallRegion[] {
  const regions: WallRegion[] = [];

  for (const item of raw.slice(0, MAX_REGIONS)) {
    if (typeof item !== "object" || item === null) continue;
    const candidate = item as { label?: unknown; polygon?: unknown };
    const polygon = candidate.polygon;
    if (!Array.isArray(polygon)) continue;

    const points: Point[] = [];
    for (const vertex of polygon) {
      if (!Array.isArray(vertex) || vertex.length < 2) continue;
      const x = Number(vertex[0]);
      const y = Number(vertex[1]);
      if (Number.isFinite(x) && Number.isFinite(y)) {
        points.push({ x: clamp(x, 0, 1), y: clamp(y, 0, 1) });
      }
      if (points.length >= MAX_VERTICES) break;
    }

    if (points.length >= 3) {
      const label = typeof candidate.label === "string" ? candidate.label : "wall";
      regions.push({ label, polygon: points });
    }
  }

  return regions;
}
