/**
 * Resize + compress an image file to a small data URL (avoids Nginx 413 on base64 uploads).
 */
export async function compressImageToDataUrl(
  file: File,
  opts: { maxEdge?: number; quality?: number; mime?: string } = {},
): Promise<string> {
  const maxEdge = opts.maxEdge ?? 512;
  const quality = opts.quality ?? 0.82;
  const mime = opts.mime ?? "image/jpeg";

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Could not process image");
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const dataUrl = canvas.toDataURL(mime, quality);
  // Keep payload well under typical 1MB Nginx default (base64 expands ~33%)
  if (dataUrl.length > 700_000) {
    return canvas.toDataURL(mime, 0.65);
  }
  return dataUrl;
}
