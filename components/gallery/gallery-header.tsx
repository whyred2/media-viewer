"use client";

import { Fragment } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import {
  ArrowLeft,
  FolderOpen,
  Grid3X3,
  Settings,
  Moon,
  Sun,
  Images,
  Search,
  SlidersHorizontal,
  ArrowDownUp,
  ArrowUp,
  ArrowDown,
  X,
} from "lucide-react";
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
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
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
import { SORT_OPTIONS } from "@/lib/gallery-sort";
import type { SortDirection, SortField } from "@/lib/types";
import type { FileTypeFilter } from "@/lib/media-formats";

export type { FileTypeFilter } from "@/lib/media-formats";

const FILE_FILTERS: { value: FileTypeFilter; label: string }[] = [
  { value: "images", label: "Images" },
  { value: "videos", label: "Videos" },
  { value: "jpg", label: "JPEG" },
  { value: "png", label: "PNG" },
  { value: "gif", label: "GIF" },
  { value: "webp", label: "WebP" },
  { value: "other", label: "Other image formats" },
];

interface GalleryHeaderProps {
  currentPath: string;
  viewMode: "folder" | "flat";
  onNavigateUp: () => void;
  onViewModeChange: (mode: "folder" | "flat") => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  typeFilters: FileTypeFilter[];
  onTypeFiltersChange: (filters: FileTypeFilter[]) => void;
  itemCount: number;
  totalCount: number;
  isLoading: boolean;
  sortBy: SortField;
  sortDirection: SortDirection;
  onSortChange: (field: SortField) => void;
  onSortDirectionChange: (direction: SortDirection) => void;
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
  itemCount,
  totalCount,
  isLoading,
  sortBy,
  sortDirection,
  onSortChange,
  onSortDirectionChange,
}: GalleryHeaderProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const pathParts = currentPath.split(/[/\\]/).filter(Boolean);
  const activeFilterCount = typeFilters.filter((type) => type !== "all").length;
  const sortLabel = SORT_OPTIONS.find((option) => option.value === sortBy)!.label;

  const folderHref = (folderPath: string) => {
    const params = new URLSearchParams();
    if (folderPath) params.set("path", folderPath);
    if (sortBy !== "name") params.set("sort", sortBy);
    if (sortDirection !== "asc") params.set("order", sortDirection);
    const query = params.toString();
    return query ? `/?${query}` : "/";
  };

  const toggleTypeFilter = (type: FileTypeFilter) => {
    if (type === "all") return onTypeFiltersChange(["all"]);
    const next = typeFilters.includes(type)
      ? typeFilters.filter((value) => value !== type)
      : [...typeFilters.filter((value) => value !== "all"), type];
    onTypeFiltersChange(next.length ? next : ["all"]);
  };

  return (
    <header className="z-10 shrink-0 border-b bg-background/95 backdrop-blur-xl">
      <div className="mx-auto w-full max-w-screen-2xl px-4 sm:px-6">
        <div className="flex py-2 items-center justify-between gap-4 border-b border-border/60">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              disabled={!currentPath || viewMode === "flat"}
              onClick={onNavigateUp}
              title="Up one folder"
              aria-label="Up one folder"
            >
              <ArrowLeft className="size-4" />
            </Button>
            <Breadcrumb className="min-w-0 overflow-x-auto py-2 [scrollbar-width:thin]">
              <BreadcrumbList className="flex-nowrap whitespace-nowrap">
                <BreadcrumbItem className="shrink-0">
                  {pathParts.length === 0 ? (
                    <BreadcrumbPage className="flex items-center gap-2 font-medium">
                      <FolderOpen className="size-4 text-muted-foreground" />
                      {viewMode === "flat" ? "All media" : "Root"}
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <Link
                        href={folderHref("")}
                        className="flex items-center gap-2 rounded-sm focus-visible:outline-2 focus-visible:outline-ring"
                      >
                        <FolderOpen className="size-4" />
                        Root
                      </Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {pathParts.map((part, index) => {
                  const folderPath = pathParts.slice(0, index + 1).join("/");
                  return (
                    <Fragment key={folderPath}>
                      <BreadcrumbSeparator />
                      <BreadcrumbItem className="min-w-0 shrink-0">
                        {index === pathParts.length - 1 ? (
                          <BreadcrumbPage
                            title={part}
                            className="max-w-52 truncate font-medium sm:max-w-80"
                          >
                            {part}
                          </BreadcrumbPage>
                        ) : (
                          <BreadcrumbLink asChild>
                            <Link
                              href={folderHref(folderPath)}
                              title={part}
                              className="max-w-40 truncate rounded-sm focus-visible:outline-2 focus-visible:outline-ring"
                            >
                              {part}
                            </Link>
                          </BreadcrumbLink>
                        )}
                      </BreadcrumbItem>
                    </Fragment>
                  );
                })}
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="relative"
              onClick={() =>
                setTheme(resolvedTheme === "dark" ? "light" : "dark")
              }
              title="Toggle theme"
              aria-label="Toggle theme"
            >
              <Sun className="size-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute size-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Settings"
                  aria-label="Settings"
                >
                  <Settings className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href="/setup">Change media folder</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 py-2">
          <div className="relative min-w-36 flex-1 sm:max-w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Search media and folders"
              placeholder="Search by filename..."
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              className="h-9 border-border/70 bg-muted/30 pr-9 pl-9 shadow-none"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-0 right-0 size-9"
                aria-label="Clear search"
                onClick={() => onSearchChange("")}
              >
                <X className="size-3.5" />
              </Button>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant={activeFilterCount ? "secondary" : "outline"}
                size="sm"
                className="h-9 gap-2 shadow-none"
                aria-label="Filter by file type"
              >
                <SlidersHorizontal className="size-3.5" />
                <span className="hidden sm:inline">Filter</span>
                {activeFilterCount > 0 && (
                  <span className="rounded bg-foreground/10 px-1.5 text-xs tabular-nums">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuLabel>File type</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={typeFilters.includes("all")}
                onCheckedChange={() => toggleTypeFilter("all")}
              >
                All media
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              {FILE_FILTERS.map(({ value, label }) => (
                <DropdownMenuCheckboxItem
                  key={value}
                  checked={typeFilters.includes(value)}
                  onCheckedChange={() => toggleTypeFilter(value)}
                >
                  {label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="flex shrink-0 items-center gap-1" role="group" aria-label="Sorting">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-2 shadow-none" aria-label={`Sort by ${sortLabel.toLowerCase()}`} title={`Sort by ${sortLabel.toLowerCase()}`}>
                  <ArrowDownUp className="size-3.5" />
                  <span className="hidden sm:inline">{sortLabel}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-44">
                <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup value={sortBy} onValueChange={(value) => onSortChange(value as SortField)}>
                  {SORT_OPTIONS.map(({ value, label }) => <DropdownMenuRadioItem key={value} value={value}>{label}</DropdownMenuRadioItem>)}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="outline" size="sm" className="h-9 gap-1.5 shadow-none"
              aria-label={sortDirection === "asc" ? "Ascending order. Switch to descending" : "Descending order. Switch to ascending"}
              aria-pressed={sortDirection === "desc"}
              title={sortDirection === "asc" ? "Ascending — click for descending" : "Descending — click for ascending"}
              onClick={() => onSortDirectionChange(sortDirection === "asc" ? "desc" : "asc")}
            >
              {sortDirection === "asc" ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />}
              {sortDirection === "asc" ? "Asc" : "Desc"}
            </Button>
          </div>
          <span
            className="order-last w-full text-xs text-muted-foreground tabular-nums sm:order-0 sm:ml-2 sm:w-auto"
            role="status"
          >
            {isLoading
              ? "Loading collection…"
              : itemCount === totalCount
                ? `${totalCount.toLocaleString()} ${totalCount === 1 ? "item" : "items"}`
                : `${itemCount.toLocaleString()} of ${totalCount.toLocaleString()} items`}
          </span>
          <Tabs
            value={viewMode}
            onValueChange={(value) =>
              onViewModeChange(value as "folder" | "flat")
            }
            className="ml-auto"
          >
            <TabsList className="h-9">
              <TabsTrigger
                value="folder"
                className="gap-1.5 px-2.5"
                aria-label="Folder view"
              >
                <Grid3X3 className="size-3.5" />
                <span className="hidden sm:inline">Folders</span>
              </TabsTrigger>
              <TabsTrigger
                value="flat"
                className="gap-1.5 px-2.5"
                aria-label="All media"
              >
                <Images className="size-3.5" />
                <span className="hidden sm:inline">All media</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>
    </header>
  );
}
