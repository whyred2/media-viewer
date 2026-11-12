"use client";

import { useRef, useEffect, useMemo, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Thumbnail } from "./thumbnail";
import type { FileItem } from "@/lib/services/file-service";

interface GalleryGridProps {
  items: FileItem[];
  onFolderClick: (path: string) => void;
  onMediaClick: (index: number) => void;
}

const GAP = 12;
const MIN_TILE_WIDTH = 150;

export function GalleryGrid({
  items,
  onFolderClick,
  onMediaClick,
}: GalleryGridProps) {
  // TanStack Virtual exposes a mutable instance; keep this component unmemoized.
  "use no memo";

  const parentRef = useRef<HTMLDivElement>(null);
  const [viewportWidth, setViewportWidth] = useState(0);

  useEffect(() => {
    const element = parentRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setViewportWidth(element.clientWidth));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const columns = Math.max(1, Math.floor((viewportWidth + GAP) / (MIN_TILE_WIDTH + GAP)));
  const tileSize = viewportWidth > 0
    ? (viewportWidth - GAP * (columns - 1)) / columns
    : MIN_TILE_WIDTH;
  const rowHeight = tileSize + GAP;

  // eslint-disable-next-line react-hooks/incompatible-library -- opted out of React Compiler above
  const virtualizer = useVirtualizer<HTMLDivElement, HTMLDivElement>({
    count: Math.ceil(items.length / columns),
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 3,
  });

  useEffect(() => {
    virtualizer.measure();
  }, [virtualizer, rowHeight]);

  useEffect(() => {
    virtualizer.scrollToOffset(0);
  }, [virtualizer, items]);

  const mediaIndices = useMemo(() => {
    const indices = new Map<string, number>();
    let mediaIndex = 0;
    for (const item of items) {
      if (!item.isDirectory) indices.set(item.relativePath, mediaIndex++);
    }
    return indices;
  }, [items]);

  return (
    <div
      ref={parentRef}
      role="region"
      aria-label="Media gallery"
      className="h-full min-h-0 overflow-auto"
      style={{ scrollbarGutter: "stable" }}
    >
      {items.length === 0 ? (
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          <p>No media or folders found</p>
        </div>
      ) : (
        <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map((row) => (
            <div
              key={row.key}
              data-index={row.index}
              className="absolute top-0 left-0 grid w-full"
              style={{
                gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                gap: GAP,
                height: tileSize,
                transform: `translateY(${row.start}px)`,
              }}
            >
              {items.slice(row.index * columns, (row.index + 1) * columns).map((item) => (
                <div key={`${item.relativePath}:${item.version}`} className="min-w-0">
                  <Thumbnail
                    relativePath={item.relativePath}
                    name={item.name}
                    version={item.version}
                    displayWidth={tileSize}
                    mediaType={item.mediaType}
                    isDirectory={item.isDirectory}
                    onClick={() => {
                      if (item.isDirectory) {
                        onFolderClick(item.relativePath);
                      } else {
                        onMediaClick(mediaIndices.get(item.relativePath)!);
                      }
                    }}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
