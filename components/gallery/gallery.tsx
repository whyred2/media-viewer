"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { GalleryGrid } from "@/components/gallery/gallery-grid";
import { GalleryHeader, type FileTypeFilter } from "@/components/gallery/gallery-header";
import { Lightbox } from "@/components/gallery/lightbox";
import { Button } from "@/components/ui/button";
import type { FileItem, MediaFile, SortDirection, SortField, ViewMode } from "@/lib/types";
import { matchesFileType } from "@/lib/media-formats";
import { parseSortDirection, parseSortField, sortGalleryItems } from "@/lib/gallery-sort";
import { toast } from "sonner";
import { Loader2, FolderOpen, SearchX, CircleAlert } from "lucide-react";

export function Gallery() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilters, setTypeFilters] = useState<FileTypeFilter[]>(["all"]);
  const activeRequest = useRef<AbortController | null>(null);
  const currentPath = searchParams.get("path") || "";
  const viewMode: ViewMode = searchParams.get("view") === "flat" ? "flat" : "folder";
  const sortBy = parseSortField(searchParams.get("sort"));
  const sortDirection = parseSortDirection(searchParams.get("order"));

  const fetchItems = useCallback(async () => {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setIsLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams({ mode: viewMode });
      if (currentPath) params.set("path", currentPath);
      const response = await fetch(`/api/files?${params}`, { signal: controller.signal });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to load this folder");
      }
      const data = await response.json();
      if (!controller.signal.aborted) setItems(data.items);
    } catch (error) {
      if (!controller.signal.aborted) {
        const message = error instanceof Error ? error.message : "Failed to load this folder";
        setItems([]);
        setLoadError(message);
        toast.error(message);
      }
    } finally {
      if (!controller.signal.aborted) setIsLoading(false);
    }
  }, [currentPath, viewMode]);

  useEffect(() => {
    void fetchItems();
    return () => activeRequest.current?.abort();
  }, [fetchItems]);

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return sortGalleryItems(items.filter((item) => {
      if (query && !item.name.toLowerCase().includes(query)) return false;
      return item.isDirectory || matchesFileType(item.name, typeFilters);
    }), sortBy, sortDirection);
  }, [items, searchQuery, typeFilters, sortBy, sortDirection]);

  const media = useMemo(() => filteredItems.filter(
    (item): item is FileItem & MediaFile => !item.isDirectory && item.extension !== undefined && item.mediaType !== undefined
  ), [filteredItems]);

  const updateSearchParams = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
    }
    const query = params.toString();
    router.push(query ? `/?${query}` : "/", { scroll: false });
  };

  const handleFolderClick = (path: string) => {
    setLightboxOpen(false);
    updateSearchParams({ path, view: "folder" });
  };

  const handleNavigateUp = () => {
    const parts = currentPath.split(/[/\\]/).filter(Boolean);
    parts.pop();
    updateSearchParams({ path: parts.join("/") || null, view: "folder" });
  };

  const handleViewModeChange = (mode: ViewMode) => {
    updateSearchParams({ view: mode, path: mode === "flat" ? null : currentPath });
  };

  const handleSortChange = (field: SortField) => {
    updateSearchParams({ sort: field === "name" ? null : field });
  };

  const handleSortDirectionChange = (direction: SortDirection) => {
    updateSearchParams({ order: direction === "asc" ? null : direction });
  };

  const hasFilters = searchQuery.trim().length > 0 || !typeFilters.includes("all");

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <GalleryHeader
        currentPath={currentPath} viewMode={viewMode}
        onNavigateUp={handleNavigateUp} onViewModeChange={handleViewModeChange}
        searchQuery={searchQuery} onSearchChange={setSearchQuery}
        typeFilters={typeFilters} onTypeFiltersChange={setTypeFilters}
        itemCount={filteredItems.length} totalCount={items.length} isLoading={isLoading}
        sortBy={sortBy} sortDirection={sortDirection}
        onSortChange={handleSortChange} onSortDirectionChange={handleSortDirectionChange}
      />
      <main className="mx-auto min-h-0 w-full max-w-screen-2xl flex-1 px-4 py-4 sm:px-6 sm:py-5" aria-busy={isLoading}>
        {isLoading ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground" role="status">
            <Loader2 className="size-6 animate-spin" /><p className="text-sm">Loading your collection…</p>
          </div>
        ) : loadError ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <CircleAlert className="size-8 text-muted-foreground" /><h1 className="text-base font-medium">Could not open this folder</h1>
            <p className="text-sm text-muted-foreground">{loadError}</p>
            <Button variant="outline" size="sm" onClick={() => void fetchItems()}>Try again</Button>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
            <div className="mb-1 flex size-16 items-center justify-center rounded-2xl bg-muted/60">
              {hasFilters ? <SearchX className="size-7 text-muted-foreground" /> : <FolderOpen className="size-7 text-muted-foreground" />}
            </div>
            <h1 className="text-base font-medium">{hasFilters ? "No matching files" : "No media here yet"}</h1>
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{hasFilters ? "Try another filename or clear the filters to see everything in this view." : "Choose another folder, or add photos and videos to this one."}</p>
            {hasFilters && <Button variant="outline" size="sm" className="mt-2" onClick={() => { setSearchQuery(""); setTypeFilters(["all"]); }}>Clear filters</Button>}
          </div>
        ) : (
          <GalleryGrid
            key={`${viewMode}:${currentPath}`} items={filteredItems}
            onFolderClick={handleFolderClick}
            onMediaClick={(index) => { setCurrentMediaIndex(index); setLightboxOpen(true); }}
          />
        )}
      </main>
      <Lightbox media={media} currentIndex={currentMediaIndex} isOpen={lightboxOpen} onClose={() => setLightboxOpen(false)} onIndexChange={setCurrentMediaIndex} />
    </div>
  );
}
