"use client";

import { useRef, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Thumbnail } from "./thumbnail";
import { FileItem } from "@/lib/services/file-service";

interface GalleryGridProps {
  items: FileItem[];
  onFolderClick: (path: string) => void;
  onImageClick: (index: number) => void;
}

export function GalleryGrid({
  items,
  onFolderClick,
  onImageClick,
}: GalleryGridProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  // Estimate row height for virtualization (approximate)
  const estimatedRowHeight = 250;

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimatedRowHeight,
    overscan: 10,
  });

  const getImageIndex = useCallback(
    (item: FileItem) => {
      // Get index among images only (for lightbox navigation)
      const images = items.filter((i) => !i.isDirectory);
      return images.findIndex((i) => i.path === item.path);
    },
    [items]
  );

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <p>No images or folders found</p>
      </div>
    );
  }

  return (
    <div ref={parentRef} className="h-full overflow-auto">
      <div className="flex flex-wrap gap-3 p-2">
        {items.map((item) => (
          <div
            key={item.path}
            className="w-[calc(20%-0.6rem)] min-w-37.5 max-w-62.5 aspect-square sm:w-[calc(25%-0.75rem)] md:w-[calc(20%-0.6rem)] lg:w-[calc(16.666%-0.625rem)]"
          >
            <Thumbnail
              relativePath={item.relativePath}
              name={item.name}
              isDirectory={item.isDirectory}
              onClick={() => {
                if (item.isDirectory) {
                  onFolderClick(item.relativePath);
                } else {
                  const imgIndex = getImageIndex(item);
                  onImageClick(imgIndex);
                }
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
