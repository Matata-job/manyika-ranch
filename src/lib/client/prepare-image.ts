/**
 * Shrink / re-encode phone gallery photos before upload.
 * Mobile cameras often produce 4–12MB HEIC/JPEG that exceed the API limit.
 */
const MAX_EDGE = 1920;
const TARGET_BYTES = 2.5 * 1024 * 1024;
const MIN_QUALITY = 0.55;

function isProbablyImage(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  // iOS / some Android galleries omit MIME or use octet-stream
  if (!file.type || file.type === "application/octet-stream") {
    return /\.(jpe?g|png|webp|heic|heif|gif|bmp)$/i.test(file.name);
  }
  return false;
}

async function canvasToJpegBlob(
  canvas: HTMLCanvasElement,
  quality: number
): Promise<Blob> {
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality)
  );
  if (!blob) throw new Error("Could not encode image");
  return blob;
}

/**
 * Returns a JPEG File sized for upload. Falls back to the original file
 * if the browser cannot decode it (rare HEIC cases on non-Safari).
 */
export async function prepareImageForUpload(file: File): Promise<File> {
  if (!isProbablyImage(file)) {
    throw new Error(`Invalid file type: ${file.type || file.name}`);
  }

  // Tiny files already under target — still re-encode large-dimension images
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    // Browser cannot decode (e.g. HEIC on Chrome). Send as-is; server may accept.
    return file;
  }

  try {
    const { width, height } = bitmap;
    const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();

    let quality = 0.82;
    let blob = await canvasToJpegBlob(canvas, quality);
    while (blob.size > TARGET_BYTES && quality > MIN_QUALITY) {
      quality -= 0.1;
      blob = await canvasToJpegBlob(canvas, quality);
    }

    const base =
      file.name.replace(/\.[^.]+$/, "") ||
      `photo-${Date.now()}`;
    return new File([blob], `${base}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}
