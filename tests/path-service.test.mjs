import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import {
  mkdtemp,
  mkdir,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  GalleryPathError,
  resolveGalleryPath,
} from "../lib/services/path-service.ts";

let temporary;
let root;

before(async () => {
  temporary = await mkdtemp(path.join(tmpdir(), "localgallery-path-"));
  root = path.join(temporary, "gallery");
  const outside = path.join(temporary, "gallery-backup");
  await mkdir(path.join(root, "holiday", "subfolder"), { recursive: true });
  await mkdir(outside);
  await writeFile(path.join(root, "holiday", "photo 你好.jpg"), "fixture");
  await writeFile(path.join(outside, "private.jpg"), "private");
  await symlink(
    outside,
    path.join(root, "outside"),
    process.platform === "win32" ? "junction" : "dir",
  );
  await symlink(
    root,
    path.join(temporary, "alias"),
    process.platform === "win32" ? "junction" : "dir",
  );
});

after(async () => {
  if (!temporary) return;
  assert.equal(path.dirname(temporary), path.resolve(tmpdir()));
  assert.ok(path.basename(temporary).startsWith("localgallery-path-"));
  await rm(temporary, { recursive: true, force: true });
});

test("resolves the configured root", async () => {
  assert.equal(await resolveGalleryPath(root), await realpath(root));
});

test("accepts spaces, Unicode, and either path separator", async () => {
  const expected = await realpath(path.join(root, "holiday", "photo 你好.jpg"));
  assert.equal(
    await resolveGalleryPath(root, "holiday/photo 你好.jpg"),
    expected,
  );
  assert.equal(
    await resolveGalleryPath(root, "holiday\\photo 你好.jpg"),
    expected,
  );
});

test("allows normalized navigation that stays inside the root", async () => {
  assert.equal(
    await resolveGalleryPath(root, "holiday/subfolder/../photo 你好.jpg"),
    await realpath(path.join(root, "holiday", "photo 你好.jpg")),
  );
});

for (const relative of [
  "..",
  "../gallery-backup/private.jpg",
  "..\\gallery-backup\\private.jpg",
  "holiday/../../gallery-backup/private.jpg",
  "/etc/passwd",
  "C:\\private.jpg",
  "C:private.jpg",
  "\\\\server\\share\\private.jpg",
  "//server/share/private.jpg",
  "photo\0.jpg",
]) {
  test(`rejects an escaping or invalid path: ${JSON.stringify(relative)}`, async () => {
    await assert.rejects(resolveGalleryPath(root, relative), GalleryPathError);
  });
}

test("rejects an absolute path even when it points inside the root", async () => {
  await assert.rejects(
    resolveGalleryPath(root, path.join(root, "holiday")),
    GalleryPathError,
  );
});

test("rejects a symlink or junction escaping the root", async () => {
  await assert.rejects(
    resolveGalleryPath(root, "outside/private.jpg"),
    GalleryPathError,
  );
});

test("accepts a root selected through a symlink or junction", async () => {
  assert.equal(
    await resolveGalleryPath(path.join(temporary, "alias"), "holiday"),
    await realpath(path.join(root, "holiday")),
  );
});

test("reports a missing file without returning an unchecked path", async () => {
  await assert.rejects(resolveGalleryPath(root, "missing.jpg"), {
    code: "ENOENT",
  });
});

test(
  "rejects Windows alternate data streams",
  { skip: process.platform !== "win32" },
  async () => {
    await assert.rejects(
      resolveGalleryPath(root, "holiday/photo.jpg:private.jpg"),
      GalleryPathError,
    );
  },
);
