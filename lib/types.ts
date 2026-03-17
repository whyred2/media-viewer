export interface GalleryImage {
  name: string;
  path: string;
  relativePath: string;
  extension: string;
}

export interface FolderItem {
  name: string;
  path: string;
  relativePath: string;
  isDirectory: true;
}

export type GalleryItem = GalleryImage | FolderItem;

export type ViewMode = "folder" | "flat";
