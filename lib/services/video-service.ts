import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { getVideoFormat } from "../media-formats";
import { thumbnailCache } from "./image-cache";

const requireTool = createRequire(import.meta.url);
const execute = promisify(execFile);
const metadataCache = new Map<string, Promise<VideoMetadata>>();

interface VideoAsset { filePath: string; version: string }
interface VideoMetadata {
  width: number | null;
  height: number | null;
  duration: number | null;
  videoCodec: string | null;
  frameRate: number | null;
}
interface ProbeOutput {
  format?: { duration?: string };
  streams?: {
    codec_type?: string; codec_name?: string; width?: number; height?: number;
    duration?: string; avg_frame_rate?: string; tags?: { rotate?: string };
    side_data_list?: { rotation?: number }[];
  }[];
}

function positive(value: number): number | null {
  return Number.isFinite(value) && value > 0 ? value : null;
}

async function probeVideo(asset: VideoAsset): Promise<VideoMetadata> {
  const tool = requireTool("@ffprobe-installer/ffprobe") as { path: string };
  const { stdout } = await execute(tool.path, [
    "-v", "error", "-protocol_whitelist", "file,pipe", "-f", getVideoFormat(asset.filePath).demuxer,
    "-show_entries", "format=duration:stream=codec_type,codec_name,width,height,duration,avg_frame_rate:stream_tags=rotate:stream_side_data=rotation",
    "-of", "json", asset.filePath,
  ], { windowsHide: true, timeout: 15000, maxBuffer: 2 * 1024 * 1024, encoding: "utf8" });
  const data = JSON.parse(stdout) as ProbeOutput;
  const video = data.streams?.find((stream) => stream.codec_type === "video");
  if (!video) throw new Error("No video stream found");
  const rotation = Number(video.tags?.rotate ?? video.side_data_list?.find((side) => side.rotation !== undefined)?.rotation ?? 0);
  const swapped = Math.abs(rotation) % 180 === 90;
  const [numerator, denominator] = (video.avg_frame_rate || "0/0").split("/").map(Number);
  return {
    width: positive((swapped ? video.height : video.width) ?? 0),
    height: positive((swapped ? video.width : video.height) ?? 0),
    duration: positive(Number(video.duration ?? data.format?.duration)),
    videoCodec: video.codec_name ?? null,
    frameRate: positive(numerator / denominator),
  };
}

export function getVideoMetadata(asset: VideoAsset): Promise<VideoMetadata> {
  const cached = metadataCache.get(asset.version);
  if (cached) return cached;
  const result = probeVideo(asset).catch((error) => {
    metadataCache.delete(asset.version);
    throw error;
  });
  metadataCache.set(asset.version, result);
  if (metadataCache.size > 256) metadataCache.delete(metadataCache.keys().next().value!);
  return result;
}

export function getVideoPosterKey(version: string, width: number): string {
  return createHash("sha256").update(`video-poster-v1:${version}:${width}`).digest("hex");
}

export function getVideoPoster(asset: VideoAsset, width: number): Promise<Buffer> {
  return thumbnailCache.getOrCreate(getVideoPosterKey(asset.version, width), async () => {
    const tool = requireTool("ffmpeg-static") as string | null;
    if (!tool) throw new Error("FFmpeg is unavailable on this platform");
    const { stdout } = await execute(tool, [
      "-nostdin", "-hide_banner", "-loglevel", "error", "-protocol_whitelist", "file,pipe",
      "-threads", "1", "-f", getVideoFormat(asset.filePath).demuxer, "-i", asset.filePath,
      "-map", "0:v:0", "-frames:v", "1", "-an", "-sn", "-dn",
      "-vf", `scale=${width}:${width}:force_original_aspect_ratio=decrease`,
      "-threads", "1", "-c:v", "png", "-f", "image2pipe", "pipe:1",
    ], { windowsHide: true, timeout: 20000, maxBuffer: 20 * 1024 * 1024, encoding: "buffer" });
    if (!stdout.length) throw new Error("No video preview frame available");
    return sharp(stdout).webp({ quality: 80, effort: 3 }).toBuffer();
  });
}
