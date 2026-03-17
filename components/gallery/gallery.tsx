"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { GalleryGrid } from "@/components/gallery/gallery-grid";
import {
  GalleryHeader,
  FileTypeFilter,
} from "@/components/gallery/gallery-header";
import { Lightbox } from "@/components/gallery/lightbox";
import { FileItem, ImageFile } from "@/lib/services/file-service";
import { ViewMode } from "@/lib/types";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export function Gallery() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [items, setItems] = useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilters, setTypeFilters] = useState<FileTypeFilter[]>(["all"]);

  const currentPath = searchParams.get("path") || "";
  const viewMode = (searchParams.get("view") as ViewMode) || "folder";

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (currentPath) params.set("path", currentPath);
      params.set("mode", viewMode);

      const response = await fetch(`/api/files?${params}`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch files");
      }

      const data = await response.json();
      setItems(data.items);
    } catch (error) {
      console.error("Error fetching items:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to load files"
      );
    } finally {
      setIsLoading(false);
    }
  }, [currentPath, viewMode]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Filter items based on search query and type filters
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!item.name.toLowerCase().includes(query)) {
          return false;
        }
      }

      // Type filter (only for images, not folders)
      if (!item.isDirectory && !typeFilters.includes("all")) {
        const ext = item.extension?.toLowerCase() || "";

        const matchesFilter = typeFilters.some((filter) => {
          switch (filter) {
            case "jpg":
              return ext === ".jpg" || ext === ".jpeg";
            case "png":
              return ext === ".png";
            case "gif":
              return ext === ".gif";
            case "webp":
              return ext === ".webp";
            case "other":
              return [".bmp", ".tiff", ".avif"].includes(ext);
            default:
              return false;
          }
        });

        if (!matchesFilter) return false;
      }

      return true;
    });
  }, [items, searchQuery, typeFilters]);

  // Extract images for lightbox navigation (from filtered items)
  const images = useMemo(() => {
    return filteredItems.filter(
      (item): item is FileItem & { extension: string } =>
        !item.isDirectory && item.extension !== undefined
    );
  }, [filteredItems]);

  const updateSearchParams = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());

    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });

    const queryString = params.toString();
    router.push(queryString ? `/?${queryString}` : "/");
  };

  const handleFolderClick = (path: string) => {
    updateSearchParams({ path, view: "folder" });
  };

  const handleNavigateUp = () => {
    if (!currentPath) return;
    const parts = currentPath.split(/[/\\]/).filter(Boolean);
    parts.pop();
    const newPath = parts.join("/");
    updateSearchParams({ path: newPath || null });
  };

  const handleViewModeChange = (mode: ViewMode) => {
    updateSearchParams({
      view: mode,
      path: mode === "flat" ? null : currentPath,
    });
  };

  const handleImageClick = (imageIndex: number) => {
    setCurrentImageIndex(imageIndex);
    setLightboxOpen(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <GalleryHeader
          currentPath={currentPath}
          viewMode={viewMode}
          onNavigateUp={handleNavigateUp}
          onViewModeChange={handleViewModeChange}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          typeFilters={typeFilters}
          onTypeFiltersChange={setTypeFilters}
        />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <GalleryHeader
        currentPath={currentPath}
        viewMode={viewMode}
        onNavigateUp={handleNavigateUp}
        onViewModeChange={handleViewModeChange}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        typeFilters={typeFilters}
        onTypeFiltersChange={setTypeFilters}
      />
      <main className="flex-1 container mx-auto px-4 py-4">
        <GalleryGrid
          items={filteredItems}
          onFolderClick={handleFolderClick}
          onImageClick={handleImageClick}
        />
      </main>
      <Lightbox
        images={images}
        currentIndex={currentImageIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        onIndexChange={setCurrentImageIndex}
      />
    </div>
  );
}
