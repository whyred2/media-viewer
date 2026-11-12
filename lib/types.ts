export interface FileMetadata {
  size: number;
  modifiedAt: string;
  version: string;
}

export interface GalleryImage extends FileMetadata {
  name: string;
  relativePath: string;
  extension: string;
}

export interface FolderItem extends FileMetadata {
  name: string;
  relativePath: string;
  isDirectory: true;
}

export type GalleryItem = GalleryImage | FolderItem;

export type ViewMode = "folder" | "flat";

export type SortField = "name" | "type" | "size" | "date";
export type SortDirection = "asc" | "desc";

export interface ImageInfo {
  name: string;
  relativePath: string;
  size: number;
  format: string;
  width: number | null;
  height: number | null;
  modifiedAt: string;
}
