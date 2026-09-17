import { test, expect } from "@playwright/test";
import path from "node:path";

const SAMPLE = path.join(process.cwd(), "public", "sample-house.png");

test.describe("house recoloring flow", () => {
  test("upload → segment → recolor → download, with a clean console", async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => pageErrors.push(String(err)));

    await page.goto("/");

    // Empty state shows the upload hero.
    await expect(page.getByText("Recolor your house walls in seconds")).toBeVisible();

    // Upload the sample image and capture the segmentation response.
    const segmentResponsePromise = page.waitForResponse(
      (res) => res.url().includes("/api/segment") && res.request().method() === "POST",
    );
    await page.setInputFiles('input[type="file"]', SAMPLE);
    const segmentResponse = await segmentResponsePromise;

    expect(segmentResponse.status()).toBe(200);
    expect(segmentResponse.headers()["content-type"]).toContain("image/png");
    // E2E runs against the deterministic mock fallback.
    expect(segmentResponse.headers()["x-mask-source"]).toBe("mock");

    // The workspace renders and the primary action becomes available.
    const downloadButton = page.getByRole("button", { name: "Download Image" });
    await expect(downloadButton).toBeEnabled({ timeout: 15_000 });

    // The composite canvas holds the full-resolution backing store.
    const composite = page.locator("canvas").first();
    await expect(composite).toBeVisible();
    const canvasWidth = await composite.evaluate((el) => (el as HTMLCanvasElement).width);
    expect(canvasWidth).toBe(800); // sample image width

    // Changing colors must not trigger any further API calls.
    let extraSegmentCalls = 0;
    page.on("request", (req) => {
      if (req.url().includes("/api/segment")) extraSegmentCalls += 1;
    });
    await page.getByRole("button", { name: "Terracotta" }).click();
    await page.getByRole("button", { name: "Forest Green" }).click();
    expect(extraSegmentCalls).toBe(0);

    // Mask overlay toggles without errors.
    await page.getByRole("button", { name: "Show mask" }).click();
    await expect(page.getByRole("button", { name: "Hide mask" })).toBeVisible();

    // Download produces a color-named PNG.
    const downloadPromise = page.waitForEvent("download");
    await downloadButton.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^recolored-house-[0-9a-f]{6}\.png$/);

    const saved = await download.path();
    expect(saved).toBeTruthy();

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
