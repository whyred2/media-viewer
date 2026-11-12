import { realpath } from "node:fs/promises";
import path from "node:path";

export class GalleryPathError extends Error {
  readonly code = "EACCES";

  constructor() {
    super("Access denied");
    this.name = "GalleryPathError";
  }
}

function isWithinDirectory(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return (
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

/** Resolve a gallery-relative path and check both lexical and real boundaries. */
export async function resolveGalleryPath(
  rootDirectory: string,
  relativePath = ""
): Promise<string> {
  if (
    relativePath.includes("\0") ||
    path.posix.isAbsolute(relativePath) ||
    path.win32.isAbsolute(relativePath) ||
    /^[a-z]:/i.test(relativePath) ||
    (process.platform === "win32" && relativePath.includes(":"))
  ) {
    throw new GalleryPathError();
  }

  const root = await realpath(path.resolve(rootDirectory));
  const target = path.resolve(root, relativePath.replace(/[\\/]/g, path.sep));
  if (!isWithinDirectory(root, target)) throw new GalleryPathError();

  const realTarget = await realpath(target);
  if (!isWithinDirectory(root, realTarget)) throw new GalleryPathError();
  return realTarget;
}
