"use client";

import { useState } from "react";
import { Folder } from "lucide-react";
import { cn } from "@/lib/utils";

interface ThumbnailProps {
  relativePath: string;
  name: string;
  isDirectory?: boolean;
  onClick?: () => void;
}

export function Thumbnail({
  relativePath,
  name,
  isDirectory,
  onClick,
}: ThumbnailProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  if (isDirectory) {
    return (
      <button
        onClick={onClick}
        className="group relative aspect-square w-full rounded-lg border bg-card hover:bg-accent transition-colors overflow-hidden flex flex-col items-center justify-center gap-2 cursor-pointer"
      >
        <Folder className="w-12 h-12 text-muted-foreground group-hover:text-foreground transition-colors" />
        <span className="text-sm text-muted-foreground group-hover:text-foreground truncate max-w-[90%] px-2">
          {name}
        </span>
      </button>
    );
  }

  const imageUrl = `/api/image?path=${encodeURIComponent(
    relativePath
  )}&size=thumbnail&width=400`;

  return (
    <button
      onClick={onClick}
      className="group relative aspect-square w-full rounded-lg overflow-hidden bg-muted cursor-pointer"
    >
      {!hasError ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={name}
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
      <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <p className="text-xs text-white truncate">{name}</p>
      </div>
    </button>
  );
}
