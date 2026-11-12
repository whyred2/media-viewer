import fs from "fs-extra";
import path from "node:path";
import { GalleryPathError, resolveGalleryPath } from "./path-service";
import { getImageVersion } from "./image-identity";
import { getMediaType } from "../media-formats";
import type { FileItem, MediaFile, MediaType } from "../types";

export type { FileItem, MediaFile } from "../types";
export { isSupportedImage } from "../media-formats";

export async function scanDirectory(rootDir: string, relativePath = ""): Promise<FileItem[]> {
  const fullPath = await resolveGalleryPath(rootDir, relativePath);
  const entries = (await fs.readdir(fullPath, { withFileTypes: true })).filter((entry) =>
    !entry.isSymbolicLink() && (entry.isDirectory() || (entry.isFile() && getMediaType(entry.name)))
  );
  const items: FileItem[] = [];
  for (let offset = 0; offset < entries.length; offset += 32) {
    const batch = await Promise.all(entries.slice(offset, offset + 32).map(async (entry): Promise<FileItem | null> => {
      try {
        const stats = await fs.lstat(path.join(fullPath, entry.name));
        const mediaType = stats.isFile() ? getMediaType(entry.name) : undefined;
        if (stats.isSymbolicLink() || (!stats.isDirectory() && !mediaType)) return null;
        return {
          name: entry.name,
          relativePath: path.posix.join(relativePath.replace(/\\/g, "/"), entry.name),
          isDirectory: stats.isDirectory(),
          extension: stats.isFile() ? path.extname(entry.name).toLowerCase() : undefined,
          mediaType,
          size: stats.isFile() ? stats.size : 0,
          modifiedAt: stats.mtime.toISOString(),
          version: getImageVersion(path.join(fullPath, entry.name), stats),
        };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      }
    }));
    for (const item of batch) if (item) items.push(item);
  }
  return items.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export async function scanAllMedia(rootDir: string, relativePath = ""): Promise<MediaFile[]> {
  const media: MediaFile[] = [];
  async function visit(directory: string) {
    for (const item of await scanDirectory(rootDir, directory)) {
      if (item.isDirectory) await visit(item.relativePath);
      else media.push({
        name: item.name, relativePath: item.relativePath, extension: item.extension!,
        mediaType: item.mediaType!, size: item.size, modifiedAt: item.modifiedAt, version: item.version,
      });
    }
  }
  await visit(relativePath);
  return media;
}

export async function getGalleryMedia(rootDirectory: string, relativePath: string, expectedType: MediaType) {
  const filePath = await resolveGalleryPath(rootDirectory, relativePath);
  const stats = await fs.stat(filePath);
  if (getMediaType(filePath) !== expectedType || !stats.isFile()) throw new GalleryPathError();
  return {
    filePath, size: stats.size, modifiedAt: stats.mtime.toISOString(),
    version: getImageVersion(filePath, stats),
  };
}

export function getGalleryImage(rootDirectory: string, relativePath: string) {
  return getGalleryMedia(rootDirectory, relativePath, "image");
}
