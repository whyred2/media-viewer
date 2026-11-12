import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createHash } from "node:crypto";
import { mkdtemp, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { ThumbnailCache } from "../lib/services/image-cache.ts";

let temporary;
const key = (name) => createHash("sha256").update(name).digest("hex");
const unexpected = async () => { throw new Error("Thumbnail was unnecessarily regenerated"); };

before(async () => { temporary = await mkdtemp(path.join(tmpdir(), "localgallery-cache-")); });
after(async () => {
  if (!temporary) return;
  assert.equal(path.dirname(temporary), path.resolve(tmpdir()));
  assert.ok(path.basename(temporary).startsWith("localgallery-cache-"));
  await rm(temporary, { recursive: true, force: true });
});

test("shares simultaneous generation and reuses the memory cache", async () => {
  const cache = new ThumbnailCache(path.join(temporary, "shared"));
  let generated = 0;
  const create = async () => {
    generated++;
    await new Promise((resolve) => setTimeout(resolve, 10));
    return Buffer.from("thumbnail");
  };
  const results = await Promise.all(Array.from({ length: 20 }, () => cache.getOrCreate(key("one"), create)));
  assert.equal(generated, 1);
  for (const result of results) assert.equal(result.toString(), "thumbnail");
  assert.equal((await cache.getOrCreate(key("one"), unexpected)).toString(), "thumbnail");
});

test("reuses persisted thumbnails in a new cache instance", async () => {
  const directory = path.join(temporary, "persisted");
  await new ThumbnailCache(directory, { memoryBytes: 0 }).getOrCreate(key("persisted"), async () => Buffer.from("saved"));
  const reopened = new ThumbnailCache(directory, { memoryBytes: 0 });
  assert.equal((await reopened.getOrCreate(key("persisted"), unexpected)).toString(), "saved");
});

test("evicts thumbnails to stay within memory and disk budgets", async () => {
  const directory = path.join(temporary, "bounded");
  const cache = new ThumbnailCache(directory, { memoryBytes: 4, diskBytes: 4 });
  await cache.getOrCreate(key("a"), async () => Buffer.from("aaaa"));
  await cache.getOrCreate(key("b"), async () => Buffer.from("bbbb"));
  const files = await readdir(directory);
  assert.equal(files.length, 1);
  assert.ok((await stat(path.join(directory, files[0]))).size <= 4);
  let regenerated = false;
  await cache.getOrCreate(key("a"), async () => { regenerated = true; return Buffer.from("aaaa"); });
  assert.equal(regenerated, true);
});

test("bounds concurrent image processing", async () => {
  const cache = new ThumbnailCache(path.join(temporary, "concurrency"), { concurrency: 2 });
  let active = 0;
  let peak = 0;
  await Promise.all(Array.from({ length: 8 }, (_, index) => cache.getOrCreate(key(String(index)), async () => {
    active++;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 10));
    active--;
    return Buffer.from("ok");
  })));
  assert.equal(peak, 2);
});

test("retries failed generation instead of retaining a rejected promise", async () => {
  const cache = new ThumbnailCache(path.join(temporary, "retry"));
  await assert.rejects(cache.getOrCreate(key("retry"), async () => { throw new Error("decoder failed"); }), /decoder failed/);
  assert.equal((await cache.getOrCreate(key("retry"), async () => Buffer.from("recovered"))).toString(), "recovered");
});

test("keeps displaying thumbnails when disk storage is unavailable", async () => {
  const filename = path.join(temporary, "not-a-directory");
  await writeFile(filename, "file");
  const cache = new ThumbnailCache(filename);
  assert.equal((await cache.getOrCreate(key("fallback"), async () => Buffer.from("available"))).toString(), "available");
  assert.equal((await cache.getOrCreate(key("fallback"), unexpected)).toString(), "available");
});

test("rejects cache keys that could escape the cache directory", () => {
  const cache = new ThumbnailCache(path.join(temporary, "keys"));
  assert.throws(() => cache.getOrCreate("../private", unexpected), /Invalid thumbnail cache key/);
});
