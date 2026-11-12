import assert from "node:assert/strict";
import { test } from "node:test";
import { parseSortDirection, parseSortField, sortGalleryItems } from "../lib/gallery-sort.ts";

const items = Object.freeze([
  { name: "z-folder", relativePath: "z-folder", isDirectory: true, size: 0, modifiedAt: "2025-11-01T00:00:00Z" },
  { name: "photo10.PNG", relativePath: "photo10.PNG", isDirectory: false, extension: ".png", size: 100, modifiedAt: "2026-01-01T00:00:00Z" },
  { name: "Photo2.jpg", relativePath: "Photo2.jpg", isDirectory: false, extension: ".jpg", size: 400, modifiedAt: "2026-03-01T00:00:00Z" },
  { name: "a-folder", relativePath: "a-folder", isDirectory: true, size: 0, modifiedAt: "2026-01-01T00:00:00Z" },
  { name: "photo1.webp", relativePath: "photo1.webp", isDirectory: false, extension: ".webp", size: 200, modifiedAt: "2026-02-01T00:00:00Z" },
].map(Object.freeze));

const cases = [
  ["name", "asc", ["a-folder", "z-folder", "photo1.webp", "Photo2.jpg", "photo10.PNG"]],
  ["name", "desc", ["z-folder", "a-folder", "photo10.PNG", "Photo2.jpg", "photo1.webp"]],
  ["type", "asc", ["a-folder", "z-folder", "Photo2.jpg", "photo10.PNG", "photo1.webp"]],
  ["type", "desc", ["z-folder", "a-folder", "photo1.webp", "photo10.PNG", "Photo2.jpg"]],
  ["size", "asc", ["a-folder", "z-folder", "photo10.PNG", "photo1.webp", "Photo2.jpg"]],
  ["size", "desc", ["z-folder", "a-folder", "Photo2.jpg", "photo1.webp", "photo10.PNG"]],
  ["date", "asc", ["z-folder", "a-folder", "photo10.PNG", "photo1.webp", "Photo2.jpg"]],
  ["date", "desc", ["a-folder", "z-folder", "Photo2.jpg", "photo1.webp", "photo10.PNG"]],
];

for (const [field, direction, expected] of cases) {
  test(`sorts by ${field} ${direction} with folders first`, () => {
    assert.deepEqual(sortGalleryItems(items, field, direction).map((item) => item.name), expected);
  });
}

test("sorts a flat collection without directory flags and leaves the input untouched", () => {
  const flat = items.filter((item) => !item.isDirectory).map(({ isDirectory, ...item }) => {
    assert.equal(isDirectory, false);
    return Object.freeze(item);
  });
  const originalPaths = flat.map((item) => item.relativePath);
  Object.freeze(flat);
  assert.deepEqual(sortGalleryItems(flat, "size", "desc").map((item) => item.size), [400, 200, 100]);
  assert.deepEqual(flat.map((item) => item.relativePath), originalPaths);
});

test("breaks equal sizes, dates, and types by name and relative location", () => {
  const sameName = ["z/photo.jpg", "a/photo.jpg"].map((relativePath) => ({
    name: "photo.jpg", relativePath, extension: ".jpg", size: 100, modifiedAt: "2026-01-01T00:00:00Z",
  }));
  for (const field of ["name", "type", "size", "date"]) {
    assert.deepEqual(sortGalleryItems(sameName, field, "asc").map((item) => item.relativePath), ["a/photo.jpg", "z/photo.jpg"]);
    assert.deepEqual(sortGalleryItems(sameName, field, "desc").map((item) => item.relativePath), ["z/photo.jpg", "a/photo.jpg"]);
  }
});

test("uses safe defaults for unset or invalid URL parameters", () => {
  for (const value of [null, "", "unknown"]) assert.equal(parseSortField(value), "name");
  for (const value of [null, "", "unknown", "ASC"]) assert.equal(parseSortDirection(value), "asc");
  assert.equal(parseSortField("date"), "date");
  assert.equal(parseSortDirection("desc"), "desc");
});
