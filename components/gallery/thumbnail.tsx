"use client";

import { useState } from "react";
import { Folder } from "lucide-react";
import { cn } from "@/lib/utils";
import { getImageUrl, getThumbnailWidth } from "@/lib/image-url";

interface ThumbnailProps {
  relativePath: string;
  name: string;
  version: string;
  displayWidth: number;
  isDirectory?: boolean;
  onClick?: () => void;
}

export function Thumbnail({
  relativePath,
  name,
  version,
  displayWidth,
  isDirectory,
  onClick,
}: ThumbnailProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  if (isDirectory) {
    return (
      <button
        onClick={onClick}
        title={name}
        aria-label={`Open folder ${name}`}
        className="group relative aspect-square w-full rounded-xl border border-border/70 bg-muted/25 hover:bg-accent transition-colors overflow-hidden flex flex-col items-center justify-center gap-3 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <Folder className="size-10 text-muted-foreground/70 group-hover:text-foreground transition-colors" />
        <span className="text-sm text-muted-foreground group-hover:text-foreground truncate max-w-[90%] px-2 font-medium">
          {name}
        </span>
      </button>
    );
  }

  const width = getThumbnailWidth(displayWidth);
  const imageUrl = getImageUrl(relativePath, version, "thumbnail", width);
  const retinaUrl = getImageUrl(relativePath, version, "thumbnail", getThumbnailWidth(width * 2));

  return (
    <button
      onClick={onClick}
      title={name}
      aria-label={`View ${name}`}
      className="group relative aspect-square w-full rounded-xl overflow-hidden bg-muted cursor-pointer border border-border/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      {!hasError ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            srcSet={`${imageUrl} 1x, ${retinaUrl} 2x`}
            alt={name}
            loading="lazy"
            decoding="async"
            className={cn(
              "absolute inset-0 w-full h-full object-cover transition-all duration-300",
              isLoading ? "opacity-0 scale-105" : "opacity-100 scale-100",
              "group-hover:scale-105"
            )}
            onLoad={() => setIsLoading(false)}
            onError={() => {
              setIsLoading(false);
              setHasError(true);
            }}
          />
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
          <span className="text-xs">Failed to load</span>
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/75 to-transparent px-3 pt-8 pb-3 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity">
        <p className="text-xs text-white truncate">{name}</p>
      </div>
    </button>
  );
}
