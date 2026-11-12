import { createHash } from "node:crypto";
import type { Stats } from "node:fs";

export function getImageVersion(filePath: string, stats: Stats): string {
  return createHash("sha256")
    .update(JSON.stringify([filePath, stats.dev, stats.ino, stats.size, stats.mtimeMs, stats.ctimeMs]))
    .digest("hex")
    .slice(0, 24);
}
