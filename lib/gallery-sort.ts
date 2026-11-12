import type { FileMetadata, SortDirection, SortField } from "./types";

export const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: "name", label: "Name" },
  { value: "type", label: "Type" },
  { value: "size", label: "Size" },
  { value: "date", label: "Date modified" },
];

interface SortableItem extends FileMetadata {
  name: string;
  relativePath: string;
  isDirectory?: boolean;
  extension?: string;
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

export function parseSortField(value: string | null): SortField {
  return SORT_OPTIONS.find((option) => option.value === value)?.value ?? "name";
}

export function parseSortDirection(value: string | null): SortDirection {
  return value === "desc" ? "desc" : "asc";
}

export function sortGalleryItems<T extends SortableItem>(
  items: readonly T[],
  field: SortField,
  direction: SortDirection,
): T[] {
  const multiplier = direction === "desc" ? -1 : 1;
  return [...items].sort((a, b) => {
    if (Boolean(a.isDirectory) !== Boolean(b.isDirectory)) {
      return a.isDirectory ? -1 : 1;
    }

    let comparison = 0;
    switch (field) {
      case "name":
        comparison = collator.compare(a.name, b.name);
        break;
      case "type":
        comparison = collator.compare(a.extension ?? "", b.extension ?? "");
        break;
      case "size":
        comparison = a.size - b.size;
        break;
      case "date":
        comparison = Date.parse(a.modifiedAt) - Date.parse(b.modifiedAt);
        break;
    }
    // Keep equal sizes/dates/types deterministic, including duplicate filenames in flat view.
    comparison = comparison ||
      collator.compare(a.name, b.name) ||
      collator.compare(a.relativePath, b.relativePath);
    return comparison * multiplier;
  });
}
