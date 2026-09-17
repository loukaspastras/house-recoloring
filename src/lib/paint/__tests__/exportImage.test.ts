import {
  buildExportFilename,
  exportCanvasToBlob,
  exportImage,
  triggerDownload,
} from "../exportImage";

describe("buildExportFilename", () => {
  it("formats the filename from a hex color", () => {
    expect(buildExportFilename("#2a4d69")).toBe("recolored-house-2a4d69.png");
    expect(buildExportFilename("2a4d69")).toBe("recolored-house-2a4d69.png");
  });
});

describe("exportCanvasToBlob", () => {
  it("resolves with the blob produced by toBlob", async () => {
    const blob = new Blob(["png-bytes"], { type: "image/png" });
    const canvas = {
      toBlob: jest.fn((cb: (b: Blob | null) => void) => cb(blob)),
    } as unknown as HTMLCanvasElement;

    await expect(exportCanvasToBlob(canvas)).resolves.toBe(blob);
    expect(canvas.toBlob).toHaveBeenCalledWith(expect.any(Function), "image/png", 1.0);
  });

  it("rejects when toBlob returns null", async () => {
    const canvas = {
      toBlob: jest.fn((cb: (b: Blob | null) => void) => cb(null)),
    } as unknown as HTMLCanvasElement;

    await expect(exportCanvasToBlob(canvas)).rejects.toThrow("toBlob returned null");
  });
});

describe("triggerDownload", () => {
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;

  afterEach(() => {
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
    jest.restoreAllMocks();
  });

  it("creates a link, clicks it, and revokes the object URL", () => {
    const createSpy = jest.fn(() => "blob:mock-url");
    const revokeSpy = jest.fn();
    URL.createObjectURL = createSpy;
    URL.revokeObjectURL = revokeSpy;
    const clickSpy = jest
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    const blob = new Blob(["data"], { type: "image/png" });
    triggerDownload(blob, "recolored-house-2a4d69.png");

    expect(createSpy).toHaveBeenCalledWith(blob);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeSpy).toHaveBeenCalledWith("blob:mock-url");
  });
});

describe("exportImage", () => {
  it("downloads under the color-derived filename", async () => {
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    URL.createObjectURL = jest.fn(() => "blob:x");
    URL.revokeObjectURL = jest.fn();
    const clickSpy = jest
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    const canvas = {
      toBlob: jest.fn((cb: (b: Blob | null) => void) => cb(new Blob(["x"], { type: "image/png" }))),
    } as unknown as HTMLCanvasElement;

    await exportImage(canvas, "#2a4d69");
    expect(clickSpy).toHaveBeenCalledTimes(1);

    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
    clickSpy.mockRestore();
  });
});
