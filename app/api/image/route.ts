import { NextRequest, NextResponse } from "next/server";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { createHash } from "node:crypto";
import path from "node:path";
import sharp from "sharp";
import { getConfig } from "@/lib/services/config-service";
import { getGalleryImage, isSupportedImage } from "@/lib/services/file-service";
import { thumbnailCache } from "@/lib/services/image-cache";
import type { ImageInfo } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const relativePath = params.get("path");
  const size = params.get("size") || "thumbnail";
  const width = Number(params.get("width") ?? "300");

  if (!relativePath) {
    return NextResponse.json({ error: "Path is required" }, { status: 400 });
  }
  if (!["thumbnail", "original", "info"].includes(size)) {
    return NextResponse.json({ error: "Invalid image size" }, { status: 400 });
  }
  if (size === "thumbnail" && (!Number.isInteger(width) || width < 1 || width > 2048)) {
    return NextResponse.json({ error: "Width must be an integer from 1 to 2048" }, { status: 400 });
  }
  if (!isSupportedImage(relativePath)) {
    return NextResponse.json({ error: "Unsupported image type" }, { status: 415 });
  }

  try {
    const config = await getConfig();
    if (!config.rootDirectory) {
      return NextResponse.json({ error: "Root directory not configured" }, { status: 400 });
    }
    // Validate the source on every server request, including cache hits and 304s.
    const image = await getGalleryImage(config.rootDirectory, relativePath);

    if (size === "info") {
      let metadata: sharp.Metadata | undefined;
      try {
        metadata = await sharp(image.filePath).metadata();
      } catch { /* basic file details remain available for an undecodable image */ }
      const swapped = (metadata?.orientation ?? 1) >= 5;
      const normalizedPath = path.posix.normalize(relativePath.replace(/\\/g, "/"));
      const info: ImageInfo = {
        name: path.posix.basename(normalizedPath),
        relativePath: normalizedPath,
        size: image.size,
        format: metadata?.format || path.extname(normalizedPath).slice(1),
        width: (swapped ? metadata?.height : metadata?.width) ?? null,
        height: (swapped ? metadata?.width : metadata?.height) ?? null,
        modifiedAt: image.modifiedAt,
      };
      return NextResponse.json(info, { headers: { "Cache-Control": "private, no-store" } });
    }

    const thumbnailKey = createHash("sha256")
      .update(["thumbnail-v1", sharp.versions.sharp, sharp.versions.vips, image.version, width].join(":"))
      .digest("hex");
    const etag = `W/"${size === "original" ? image.version : thumbnailKey}"`;
    const headers = new Headers({
      "Cache-Control": params.get("v") === image.version
        ? "private, max-age=31536000, immutable"
        : "private, no-cache",
      "ETag": etag,
      "Last-Modified": new Date(image.modifiedAt).toUTCString(),
      "X-Content-Type-Options": "nosniff",
    });
    const unchanged = request.headers.get("if-none-match")?.split(",").some((value) => {
      const tag = value.trim();
      return tag === "*" || tag.replace(/^W\//, "") === etag.replace(/^W\//, "");
    });
    if (unchanged) return new NextResponse(null, { status: 304, headers });

    if (size === "original") {
      headers.set("Content-Type", getContentType(path.extname(relativePath).toLowerCase()));
      headers.set("Content-Length", String(image.size));
      const stream = Readable.toWeb(createReadStream(image.filePath), {
        strategy: { highWaterMark: 256 * 1024, size: (chunk: Uint8Array) => chunk.byteLength },
      }) as ReadableStream<Uint8Array>;
      return new NextResponse(stream, { headers });
    }

    const thumbnail = await thumbnailCache.getOrCreate(thumbnailKey, () =>
      sharp(image.filePath)
        .rotate()
        .resize(width, null, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 80, effort: 3 })
        .toBuffer()
    );
    headers.set("Content-Type", "image/webp");
    headers.set("Content-Length", String(thumbnail.length));
    return new NextResponse(new Uint8Array(thumbnail), { headers });
  } catch (error) {
    console.error("Error serving image:", error);
    const code = (error as NodeJS.ErrnoException).code || "";
    if (["ENOENT", "ENOTDIR", "EISDIR"].includes(code)) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }
    if (["EACCES", "EPERM", "ELOOP"].includes(code)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to process image" }, { status: 500 });
  }
}

function getContentType(extension: string): string {
  const types: Record<string, string> = {
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".gif": "image/gif",
    ".webp": "image/webp", ".bmp": "image/bmp", ".tiff": "image/tiff", ".avif": "image/avif",
  };
  return types[extension] || "application/octet-stream";
}
