import assert from "node:assert/strict";
import { test } from "node:test";
import { getMediaType, isSupportedVideo, matchesFileType } from "../lib/media-formats.ts";

test("recognizes video and image formats without accepting other files", () => {
  for (const extension of ["mp4", "M4V", "webm", "MOV", "mkv", "avi", "ogv"]) {
    assert.equal(getMediaType(`holiday/clip.${extension}`), "video");
  }
  for (const extension of ["jpg", "JPEG", "png", "gif", "webp", "tiff", "avif", "bmp"]) {
    assert.equal(getMediaType(`photo.${extension}`), "image");
  }
  for (const name of ["file.txt", "clip.mp4.exe", "folder.mp4/no-extension", "music.mp3", "file.html"]) {
    assert.equal(getMediaType(name), undefined);
    assert.equal(isSupportedVideo(name), false);
  }
});

test("filters mixed collections by media category and image format", () => {
  assert.equal(matchesFileType("clip.mp4", ["videos"]), true);
  assert.equal(matchesFileType("photo.jpg", ["videos"]), false);
  assert.equal(matchesFileType("photo.jpg", ["images"]), true);
  assert.equal(matchesFileType("clip.webm", ["images"]), false);
  assert.equal(matchesFileType("clip.mov", ["other"]), false);
  assert.equal(matchesFileType("photo.avif", ["other"]), true);
  assert.equal(matchesFileType("clip.webm", ["jpg", "videos"]), true);
  assert.equal(matchesFileType("photo.JPEG", ["jpg", "videos"]), true);
  assert.equal(matchesFileType("photo.png", ["jpg", "videos"]), false);
});
