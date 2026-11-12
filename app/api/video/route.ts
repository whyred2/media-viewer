import { NextRequest, NextResponse } from "next/server";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import path from "node:path";
import { getConfig } from "@/lib/services/config-service";
import { getGalleryMedia } from "@/lib/services/file-service";
import { getVideoMetadata, getVideoPoster, getVideoPosterKey } from "@/lib/services/video-service";
import { getVideoFormat, isSupportedVideo } from "@/lib/media-formats";
import { allowsRange, parseByteRange } from "@/lib/http-range";
import type { VideoInfo } from "@/lib/types";

export const runtime = "nodejs";

async function handleRequest(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const relativePath = params.get("path");
  const mode = params.get("size") || "original";
  const width = Number(params.get("width") ?? "300");
  const head = request.method === "HEAD";
  if (!relativePath) return NextResponse.json({ error: "Path is required" }, { status: 400 });
  if (!["original", "thumbnail", "info"].includes(mode)) return NextResponse.json({ error: "Invalid video size" }, { status: 400 });
  if (mode === "thumbnail" && (!Number.isInteger(width) || width < 1 || width > 2048)) {
    return NextResponse.json({ error: "Width must be an integer from 1 to 2048" }, { status: 400 });
  }
  if (!isSupportedVideo(relativePath)) return NextResponse.json({ error: "Unsupported video type" }, { status: 415 });
  try {
    const config = await getConfig();
    if (!config.rootDirectory) return NextResponse.json({ error: "Root directory not configured" }, { status: 400 });
    const video = await getGalleryMedia(config.rootDirectory, relativePath, "video");
    if (mode === "info") {
      const headers = { "Cache-Control": "private, no-store", "Content-Type": "application/json" };
      if (head) return new NextResponse(null, { headers });
      let metadata;
      try { metadata = await getVideoMetadata(video); } catch { /* basic file information is still available */ }
      const normalized = path.posix.normalize(relativePath.replace(/\\/g, "/"));
      const info: VideoInfo = {
        name: path.posix.basename(normalized), relativePath: normalized, size: video.size,
        format: path.extname(normalized).slice(1), modifiedAt: video.modifiedAt,
        width: metadata?.width ?? null, height: metadata?.height ?? null,
        duration: metadata?.duration ?? null, videoCodec: metadata?.videoCodec ?? null, frameRate: metadata?.frameRate ?? null,
      };
      return NextResponse.json(info, { headers });
    }
    const etag = `"${mode === "original" ? video.version : getVideoPosterKey(video.version, width)}"`;
    const headers = new Headers({
      "Cache-Control": params.get("v") === video.version ? "private, max-age=31536000, immutable" : "private, no-cache",
      "ETag": etag, "Last-Modified": new Date(video.modifiedAt).toUTCString(), "X-Content-Type-Options": "nosniff",
    });
    if (request.headers.get("if-none-match")?.split(",").some((value) => value.trim() === "*" || value.trim().replace(/^W\//, "") === etag)) {
      return new NextResponse(null, { status: 304, headers });
    }
    if (mode === "thumbnail") {
      headers.set("Content-Type", "image/webp");
      if (head) return new NextResponse(null, { headers });
      const poster = await getVideoPoster(video, width);
      headers.set("Content-Length", String(poster.length));
      return new NextResponse(new Uint8Array(poster), { headers });
    }
    headers.set("Content-Type", getVideoFormat(video.filePath).mime);
    headers.set("Accept-Ranges", "bytes");
    // HEAD describes the full representation; seeking only applies to GET.
    const range = !head && allowsRange(request.headers.get("if-range"), etag, video.modifiedAt)
      ? parseByteRange(request.headers.get("range"), video.size) : null;
    if (range === "invalid") {
      headers.set("Cache-Control", "private, no-store");
      headers.set("Content-Range", `bytes */${video.size}`);
      return new NextResponse(null, { status: 416, headers });
    }
    headers.set("Content-Length", String(range ? range.end - range.start + 1 : video.size));
    if (range) headers.set("Content-Range", `bytes ${range.start}-${range.end}/${video.size}`);
    const status = range ? 206 : 200;
    if (head || video.size === 0) return new NextResponse(null, { status, headers });
    const stream = Readable.toWeb(createReadStream(video.filePath, range || undefined), {
      strategy: { highWaterMark: 256 * 1024, size: (chunk: Uint8Array) => chunk.byteLength },
    }) as ReadableStream<Uint8Array>;
    return new NextResponse(stream, { status, headers });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code || "";
    if (["ENOENT", "ENOTDIR", "EISDIR"].includes(code)) return NextResponse.json({ error: "Video not found" }, { status: 404 });
    if (["EACCES", "EPERM", "ELOOP"].includes(code)) return NextResponse.json({ error: "Access denied" }, { status: 403 });
    console.error("Error serving video:", error);
    return NextResponse.json({ error: "Failed to process video" }, { status: 500 });
  }
}

export const GET = handleRequest;
export const HEAD = handleRequest;
