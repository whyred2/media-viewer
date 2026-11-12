import fs from "fs-extra";
import path from "node:path";
import { GalleryPathError, resolveGalleryPath } from "./path-service";
import type { FileMetadata } from "../types";
import { getImageVersion } from "./image-identity";

export interface FileItem extends FileMetadata {
  name: string;
  relativePath: string;
  isDirectory: boolean;
  extension?: string;
}

export interface ImageFile extends FileMetadata {
  name: string;
  relativePath: string;
  extension: string;
}

const SUPPORTED_EXTENSIONS = new Set([
  ".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".tiff", ".avif",
]);

export function isSupportedImage(filename: string): boolean {
  return SUPPORTED_EXTENSIONS.has(path.extname(filename).toLowerCase());
}

export async function scanDirectory(
  rootDir: string,
  relativePath = ""
): Promise<FileItem[]> {
  const fullPath = await resolveGalleryPath(rootDir, relativePath);
  const entries = await fs.readdir(fullPath, { withFileTypes: true });
  const items: FileItem[] = [];

  const visibleEntries = entries.filter((entry) =>
    !entry.isSymbolicLink() &&
    (entry.isDirectory() || (entry.isFile() && isSupportedImage(entry.name)))
  );
  // Bound metadata reads so a large collection does not flood the filesystem.
  for (let offset = 0; offset < visibleEntries.length; offset += 32) {
    const batch = await Promise.all(
      visibleEntries.slice(offset, offset + 32).map(async (entry): Promise<FileItem | null> => {
      try {
        const stats = await fs.lstat(path.join(fullPath, entry.name));
        if (
          stats.isSymbolicLink() ||
          (!stats.isDirectory() && (!stats.isFile() || !isSupportedImage(entry.name)))
        ) return null;
        return {
          name: entry.name,
          relativePath: path.posix.join(relativePath.replace(/\\/g, "/"), entry.name),
          isDirectory: stats.isDirectory(),
          extension: stats.isFile() ? path.extname(entry.name).toLowerCase() : undefined,
          size: stats.isFile() ? stats.size : 0,
          modifiedAt: stats.mtime.toISOString(),
          version: getImageVersion(path.join(fullPath, entry.name), stats),
        };
      } catch (error) {
        // A file can disappear while the folder is being scanned.
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      }
      })
    );
    for (const item of batch) if (item) items.push(item);
  }

  return items.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export async function scanAllImages(
  rootDir: string,
  relativePath = ""
): Promise<ImageFile[]> {
  const images: ImageFile[] = [];

  async function visit(directory: string) {
    const items = await scanDirectory(rootDir, directory);
    for (const item of items) {
      if (item.isDirectory) {
        await visit(item.relativePath);
      } else {
        images.push({
          name: item.name,
          relativePath: item.relativePath,
          extension: item.extension!,
          size: item.size,
          modifiedAt: item.modifiedAt,
          version: item.version,
        });
      }
    }
  }

  await visit(relativePath);
  return images;
}

export async function getGalleryImage(
  rootDirectory: string,
  relativePath: string
) {
  const imagePath = await resolveGalleryPath(rootDirectory, relativePath);
  const stats = await fs.stat(imagePath);
  // Check the resolved filename too: an alias must not expose a non-image file.
  if (!isSupportedImage(imagePath) || !stats.isFile()) {
    throw new GalleryPathError();
  }
  return {
    filePath: imagePath,
    size: stats.size,
    modifiedAt: stats.mtime.toISOString(),
    version: getImageVersion(imagePath, stats),
  };
}
