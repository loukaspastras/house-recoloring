/** @jest-environment node */

import { POST } from "../route";
import { segmentImageToPng } from "@/lib/segment";

jest.mock("@/lib/segment", () => ({
  segmentImageToPng: jest.fn(),
}));

const mockedSegment = segmentImageToPng as jest.MockedFunction<typeof segmentImageToPng>;

function formRequest(file?: File): Request {
  const form = new FormData();
  if (file) form.append("image", file);
  return new Request("http://localhost/api/segment", { method: "POST", body: form });
}

beforeEach(() => {
  mockedSegment.mockReset();
});

describe("POST /api/segment", () => {
  it("rejects non-multipart requests with 400", async () => {
    const request = new Request("http://localhost/api/segment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(request);
    expect(res.status).toBe(400);
  });

  it("rejects a missing image field with 400", async () => {
    const res = await POST(formRequest());
    expect(res.status).toBe(400);
  });

  it("rejects an unsupported image type with 400", async () => {
    const file = new File([new Uint8Array(4)], "x.gif", { type: "image/gif" });
    const res = await POST(formRequest(file));
    expect(res.status).toBe(400);
  });

  it("rejects an empty file with 400", async () => {
    const file = new File([], "x.png", { type: "image/png" });
    const res = await POST(formRequest(file));
    expect(res.status).toBe(400);
  });

  it("rejects an oversize file with 413", async () => {
    const file = new File([new Uint8Array(15 * 1024 * 1024 + 1)], "x.png", {
      type: "image/png",
    });
    const res = await POST(formRequest(file));
    expect(res.status).toBe(413);
  });

  it("returns a PNG mask with provenance headers", async () => {
    mockedSegment.mockResolvedValue({
      png: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      width: 100,
      height: 50,
      source: "mock",
    });

    const file = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], "house.jpg", {
      type: "image/jpeg",
    });
    const res = await POST(formRequest(file));

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("x-mask-source")).toBe("mock");
    expect(res.headers.get("x-mask-width")).toBe("100");
    expect(res.headers.get("x-mask-height")).toBe("50");

    const body = Buffer.from(await res.arrayBuffer());
    expect(body.length).toBeGreaterThan(0);
    expect(mockedSegment).toHaveBeenCalledTimes(1);
  });

  it("returns 500 when segmentation throws", async () => {
    mockedSegment.mockRejectedValue(new Error("boom"));
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], "house.jpg", {
      type: "image/jpeg",
    });
    const res = await POST(formRequest(file));
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Segmentation failed");
  });
});
