"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  ChevronLeft,
  FolderOpen,
  Grid3X3,
  Settings,
  Moon,
  Sun,
  Images,
  Search,
  Filter,
  X,
} from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";

export type FileTypeFilter = "all" | "jpg" | "png" | "gif" | "webp" | "other";

interface GalleryHeaderProps {
  currentPath: string;
  viewMode: "folder" | "flat";
  onNavigateUp: () => void;
  onViewModeChange: (mode: "folder" | "flat") => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  typeFilters: FileTypeFilter[];
  onTypeFiltersChange: (filters: FileTypeFilter[]) => void;
}

export function GalleryHeader({
  currentPath,
  viewMode,
  onNavigateUp,
  onViewModeChange,
  searchQuery,
  onSearchChange,
  typeFilters,
  onTypeFiltersChange,
}: GalleryHeaderProps) {
  const { theme, setTheme } = useTheme();

  const pathParts = currentPath
    ? currentPath.split(/[/\\]/).filter(Boolean)
    : [];

  const toggleTypeFilter = (type: FileTypeFilter) => {
    if (type === "all") {
      onTypeFiltersChange(["all"]);
    } else {
      const newFilters = typeFilters.includes(type)
        ? typeFilters.filter((t) => t !== type)
        : [...typeFilters.filter((t) => t !== "all"), type];
      onTypeFiltersChange(newFilters.length === 0 ? ["all"] : newFilters);
    }
  };

  const hasActiveFilters =
    !typeFilters.includes("all") || searchQuery.length > 0;

  return (
    <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {currentPath && viewMode === "folder" && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onNavigateUp}
                title="Go up"
              >
                <ChevronLeft className="size-5" />
              </Button>
            )}

            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/" className="flex items-center gap-2">
                    <FolderOpen className="size-4" />
                    Root
                  </BreadcrumbLink>
                </BreadcrumbItem>
                {pathParts.length > 0 && (
                  <>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbPage className="max-w-50 sm:max-w-100 truncate">
                        {pathParts.join(" / ")}
                      </BreadcrumbPage>
                    </BreadcrumbItem>
                  </>
                )}
              </BreadcrumbList>
            </Breadcrumb>
          </div>

          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-8 pr-8 w-32 sm:w-48 h-9"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-9 w-8"
                  onClick={() => onSearchChange("")}
                >
                  <X className="size-3" />
                </Button>
              )}
            </div>

            {/* Type Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant={hasActiveFilters ? "secondary" : "ghost"}
                  size="icon"
                  title="Filter by type"
                >
                  <Filter className="size-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>File Type</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={typeFilters.includes("all")}
                  onCheckedChange={() => toggleTypeFilter("all")}
                >
                  All Types
                </DropdownMenuCheckboxItem>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={typeFilters.includes("jpg")}
                  onCheckedChange={() => toggleTypeFilter("jpg")}
                >
                  JPEG (.jpg, .jpeg)
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={typeFilters.includes("png")}
                  onCheckedChange={() => toggleTypeFilter("png")}
                >
                  PNG (.png)
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={typeFilters.includes("gif")}
                  onCheckedChange={() => toggleTypeFilter("gif")}
                >
                  GIF (.gif)
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={typeFilters.includes("webp")}
                  onCheckedChange={() => toggleTypeFilter("webp")}
                >
                  WebP (.webp)
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={typeFilters.includes("other")}
                  onCheckedChange={() => toggleTypeFilter("other")}
                >
                  Other (.bmp, .tiff, .avif)
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Tabs
              value={viewMode}
              onValueChange={(value) =>
                onViewModeChange(value as "folder" | "flat")
              }
            >
              <TabsList>
                <TabsTrigger value="folder" className="gap-1">
                  <Grid3X3 className="size-4" />
                  <span className="hidden sm:inline">Folders</span>
                </TabsTrigger>
                <TabsTrigger value="flat" className="gap-1">
                  <Images className="size-4" />
                  <span className="hidden sm:inline">All Photos</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              title="Toggle theme"
            >
              <Sun className="size-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute size-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" title="Settings">
                  <Settings className="size-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href="/setup">Change Photos Folder</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
}
