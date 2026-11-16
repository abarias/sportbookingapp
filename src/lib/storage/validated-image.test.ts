import { describe, expect, it } from "vitest";

import { MAX_IMAGE_BYTES, validateAndNormalizeImage } from "@/lib/storage/validated-image";

const tinyPng = Uint8Array.from([
  137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82,
  0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137,
  0, 0, 0, 13, 73, 68, 65, 84, 120, 156, 99, 248, 207, 192, 240,
  31, 0, 5, 0, 1, 255, 137, 153, 61, 29, 0, 0, 0, 0, 73, 69,
  78, 68, 174, 66, 96, 130
]);

function imageFile(bytes: Uint8Array, type = "application/octet-stream") {
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new File([buffer], "receipt.bin", { type });
}

describe("validateAndNormalizeImage", () => {
  it("decodes image bytes and normalizes them to metadata-free WebP", async () => {
    const result = await validateAndNormalizeImage(imageFile(tinyPng, "text/plain"));

    expect(result.contentType).toBe("image/webp");
    expect(result.extension).toBe(".webp");
    expect(result.bytes.byteLength).toBeGreaterThan(0);
  });

  it("rejects non-image bytes even when the browser claims they are an image", async () => {
    await expect(validateAndNormalizeImage(imageFile(Uint8Array.from([1, 2, 3]), "image/png"))).rejects.toThrow(/valid JPEG/);
  });

  it("rejects files over the upload limit before decoding", async () => {
    const bytes = new Uint8Array(MAX_IMAGE_BYTES + 1);

    await expect(validateAndNormalizeImage(imageFile(bytes, "image/png"))).rejects.toThrow(/5MB/);
  });
});
