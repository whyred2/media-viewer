import type { MediaType } from "./types";

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".tiff", ".avif"]);
const VIDEO_FORMATS: Record<string, { mime: string; demuxer: string }> = {
  ".mp4": { mime: "video/mp4", demuxer: "mov" },
  ".m4v": { mime: "video/mp4", demuxer: "mov" },
  ".mov": { mime: "video/quicktime", demuxer: "mov" },
  ".webm": { mime: "video/webm", demuxer: "matroska" },
  ".mkv": { mime: "video/x-matroska", demuxer: "matroska" },
  ".avi": { mime: "video/x-msvideo", demuxer: "avi" },
  ".ogv": { mime: "video/ogg", demuxer: "ogg" },
};

export type FileTypeFilter = "all" | "images" | "videos" | "jpg" | "png" | "gif" | "webp" | "other";

export function getExtension(filename: string): string {
  return filename.toLowerCase().match(/\.[^./\\]+$/)?.[0] ?? "";
}

export function isSupportedImage(filename: string): boolean {
  return IMAGE_EXTENSIONS.has(getExtension(filename));
}

export function isSupportedVideo(filename: string): boolean {
  return Object.hasOwn(VIDEO_FORMATS, getExtension(filename));
}

export function getMediaType(filename: string): MediaType | undefined {
  if (isSupportedImage(filename)) return "image";
  if (isSupportedVideo(filename)) return "video";
}

export function getVideoFormat(filename: string) {
  return VIDEO_FORMATS[getExtension(filename)];
}

export function matchesFileType(filename: string, filters: readonly FileTypeFilter[]): boolean {
  if (filters.includes("all")) return true;
  const extension = getExtension(filename);
  return filters.some((filter) => {
    switch (filter) {
      case "images": return isSupportedImage(filename);
      case "videos": return isSupportedVideo(filename);
      case "jpg": return extension === ".jpg" || extension === ".jpeg";
      case "png": return extension === ".png";
      case "gif": return extension === ".gif";
      case "webp": return extension === ".webp";
      case "other": return [".bmp", ".tiff", ".avif"].includes(extension);
      default: return false;
    }
  });
}
