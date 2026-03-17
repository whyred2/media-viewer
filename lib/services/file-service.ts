import fs from "fs-extra";
import path from "path";

export interface FileItem {
  name: string;
  path: string;
  relativePath: string;
  isDirectory: boolean;
  extension?: string;
}

export interface ImageFile {
  name: string;
  path: string;
  relativePath: string;
  extension: string;
}

const SUPPORTED_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".bmp",
  ".tiff",
  ".avif",
];

export function isSupportedImage(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return SUPPORTED_EXTENSIONS.includes(ext);
}

export async function scanDirectory(
  rootDir: string,
  relativePath: string = ""
): Promise<FileItem[]> {
  const fullPath = path.join(rootDir, relativePath);
  const items: FileItem[] = [];

  try {
    const entries = await fs.readdir(fullPath, { withFileTypes: true });

    for (const entry of entries) {
      const itemRelativePath = path.join(relativePath, entry.name);
      const itemFullPath = path.join(rootDir, itemRelativePath);

      if (entry.isDirectory()) {
        items.push({
          name: entry.name,
          path: itemFullPath,
          relativePath: itemRelativePath,
          isDirectory: true,
        });
      } else if (isSupportedImage(entry.name)) {
        items.push({
          name: entry.name,
          path: itemFullPath,
          relativePath: itemRelativePath,
          isDirectory: false,
          extension: path.extname(entry.name).toLowerCase(),
        });
      }
    }

    // Sort: folders first, then files, both alphabetically
    items.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });

    return items;
  } catch (error) {
    console.error("Error scanning directory:", error);
    throw error;
  }
}

export async function scanAllImages(
  rootDir: string,
  relativePath: string = ""
): Promise<ImageFile[]> {
  const fullPath = path.join(rootDir, relativePath);
  const images: ImageFile[] = [];

  try {
    const entries = await fs.readdir(fullPath, { withFileTypes: true });

    for (const entry of entries) {
      const itemRelativePath = path.join(relativePath, entry.name);
      const itemFullPath = path.join(rootDir, itemRelativePath);

      if (entry.isDirectory()) {
        // Recursively scan subdirectories
        const subImages = await scanAllImages(rootDir, itemRelativePath);
        images.push(...subImages);
      } else if (isSupportedImage(entry.name)) {
        images.push({
          name: entry.name,
          path: itemFullPath,
          relativePath: itemRelativePath,
          extension: path.extname(entry.name).toLowerCase(),
        });
      }
    }

    return images;
  } catch (error) {
    console.error("Error scanning images:", error);
    throw error;
  }
}

export async function getImageBuffer(imagePath: string): Promise<Buffer> {
  try {
    return await fs.readFile(imagePath);
  } catch (error) {
    console.error("Error reading image:", error);
    throw error;
  }
}
