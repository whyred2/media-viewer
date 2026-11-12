export function getImageUrl(
  relativePath: string,
  version: string,
  size: "thumbnail" | "original",
  width?: number,
): string {
  const params = new URLSearchParams({ path: relativePath, size, v: version });
  if (size === "thumbnail" && width) params.set("width", String(width));
  return `/api/image?${params}`;
}

export function getThumbnailWidth(displayWidth: number): number {
  const widths = [192, 256, 384, 512, 768, 1024];
  return widths.find((width) => width >= displayWidth) ?? 1024;
}
