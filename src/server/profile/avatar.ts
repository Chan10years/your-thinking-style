import sharp, { type Metadata } from "sharp";

export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
const AVATAR_MAX_PIXELS = 25_000_000;

const MIME_TO_FORMAT = {
  "image/jpeg": { format: "jpeg", extensions: [".jpg", ".jpeg"] },
  "image/png": { format: "png", extensions: [".png"] },
  "image/webp": { format: "webp", extensions: [".webp"] },
} as const;

function invalidAvatar(): Error {
  return new Error("头像格式不合法，请上传 JPEG、PNG 或 WebP 图片。");
}

export async function normalizeAvatarFile(file: File): Promise<Buffer> {
  if (file.size > AVATAR_MAX_BYTES) {
    throw new Error("头像文件不能超过 5MB。");
  }

  const formatConfig = MIME_TO_FORMAT[file.type as keyof typeof MIME_TO_FORMAT];
  const lowerName = file.name.toLowerCase();
  if (!formatConfig || !formatConfig.extensions.some((ext) => lowerName.endsWith(ext))) {
    throw invalidAvatar();
  }

  const input = Buffer.from(await file.arrayBuffer());
  if (input.byteLength > AVATAR_MAX_BYTES) {
    throw new Error("头像文件不能超过 5MB。");
  }

  let metadata: Metadata;
  try {
    metadata = await sharp(input, { limitInputPixels: AVATAR_MAX_PIXELS }).metadata();
  } catch {
    throw invalidAvatar();
  }

  if (
    metadata.format !== formatConfig.format ||
    !metadata.width ||
    !metadata.height ||
    metadata.width * metadata.height > AVATAR_MAX_PIXELS
  ) {
    throw invalidAvatar();
  }

  try {
    return await sharp(input, { limitInputPixels: AVATAR_MAX_PIXELS })
      .rotate()
      .resize(256, 256, { fit: "cover", position: "centre" })
      .webp({ quality: 85 })
      .toBuffer();
  } catch {
    throw invalidAvatar();
  }
}
