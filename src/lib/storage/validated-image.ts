import sharp from "sharp";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 40_000_000;

const SUPPORTED_FORMATS = new Set(["jpeg", "png", "webp", "gif"]);

export type ValidatedImage = {
  bytes: Buffer;
  contentType: "image/webp";
  extension: ".webp";
};

/** Decode and re-encode uploads so storage never trusts browser metadata or filenames. */
export async function validateAndNormalizeImage(file: File): Promise<ValidatedImage> {
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Choose an image file.");
  }

  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("Images must be 5MB or smaller.");
  }

  const input = Buffer.from(await file.arrayBuffer());
  try {
    const image = sharp(input, { failOn: "error", limitInputPixels: MAX_IMAGE_PIXELS });
    const metadata = await image.metadata();

    if (!metadata.format || !SUPPORTED_FORMATS.has(metadata.format)) {
      throw new Error("unsupported format");
    }

    if (!metadata.width || !metadata.height || metadata.width * metadata.height > MAX_IMAGE_PIXELS) {
      throw new Error("dimensions are too large");
    }

    const bytes = await image
      .rotate()
      .resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();

    return { bytes, contentType: "image/webp", extension: ".webp" };
  } catch {
    throw new Error("Only valid JPEG, PNG, WebP, or GIF images within the supported dimensions are accepted.");
  }
}
