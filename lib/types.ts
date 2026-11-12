export interface FileMetadata {
  size: number;
  modifiedAt: string;
  version: string;
}

export type MediaType = "image" | "video";

export interface MediaFile extends FileMetadata {
  name: string;
  relativePath: string;
  extension: string;
  mediaType: MediaType;
}

export interface FileItem extends FileMetadata {
  name: string;
  relativePath: string;
  isDirectory: boolean;
  extension?: string;
  mediaType?: MediaType;
}

export interface FolderItem extends FileMetadata {
  name: string;
  relativePath: string;
  isDirectory: true;
}

export type GalleryItem = MediaFile | FolderItem;

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

export interface VideoInfo extends ImageInfo {
  duration: number | null;
  videoCodec: string | null;
  frameRate: number | null;
}
