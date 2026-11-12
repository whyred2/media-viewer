import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { spawn, execFile } from "node:child_process";
import { once } from "node:events";
import { promisify } from "node:util";
import { mkdtemp, mkdir, readFile, writeFile, rm, symlink } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import ffmpeg from "ffmpeg-static";
import sharp from "sharp";

const execute = promisify(execFile);
let temporary;
let root;
let origin;
let server;
let source;
let version;
const videoName = "клип one.mp4";

before(async () => {
  temporary = await mkdtemp(path.join(tmpdir(), "localgallery-video-"));
  root = path.join(temporary, "gallery");
  const outside = path.join(temporary, "gallery-backup");
  await mkdir(path.join(root, "nested"), { recursive: true });
  await mkdir(outside);
  await execute(ffmpeg, [
    "-y", "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=size=320x180:rate=12",
    "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=44100", "-t", "1",
    "-c:v", "libx264", "-preset", "ultrafast", "-threads", "1", "-pix_fmt", "yuv420p", "-c:a", "aac",
    "-movflags", "+faststart", path.join(root, videoName),
  ], { windowsHide: true, timeout: 30000 });
  await execute(ffmpeg, [
    "-y", "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=size=160x90:rate=6", "-t", "1",
    "-c:v", "libvpx", "-deadline", "realtime", "-threads", "1", "-an", path.join(root, "nested", "clip.webm"),
  ], { windowsHide: true, timeout: 30000 });
  source = await readFile(path.join(root, videoName));
  await writeFile(path.join(outside, "private.mp4"), source);
  await writeFile(path.join(root, "private.txt"), "not media");
  await writeFile(path.join(root, "empty.mp4"), "");
  await writeFile(path.join(root, "photo.png"), await sharp({ create: { width: 32, height: 32, channels: 3, background: "blue" } }).png().toBuffer());
  await symlink(outside, path.join(root, "outside"), process.platform === "win32" ? "junction" : "dir");
  const configFile = path.join(temporary, "config.json");
  await writeFile(configFile, JSON.stringify({ rootDirectory: root }));
  const reservation = createServer().listen(0, "127.0.0.1");
  await once(reservation, "listening");
  const port = reservation.address().port;
  await new Promise((resolve) => reservation.close(resolve));
  origin = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", String(port)], {
    windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, LOCAL_GALLERY_CONFIG: configFile, LOCAL_GALLERY_CACHE: path.join(temporary, "cache"), NEXT_TELEMETRY_DISABLED: "1" },
  });
  let logs = "";
  server.stdout.on("data", (chunk) => { logs = (logs + chunk).slice(-16000); });
  server.stderr.on("data", (chunk) => { logs = (logs + chunk).slice(-16000); });
  for (let attempt = 0; attempt < 200; attempt++) {
    if (server.exitCode !== null) throw new Error(logs);
    try {
      const response = await fetch(`${origin}/api/files`);
      if (response.ok) {
        version = (await response.json()).items.find((item) => item.name === videoName).version;
        return;
      }
    } catch { /* server is still starting */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Video test server did not start.\n${logs}`);
}, { timeout: 60000 });

after(async () => {
  if (server && server.exitCode === null) {
    const exited = once(server, "exit");
    server.kill();
    await exited;
  }
  if (!temporary) return;
  assert.equal(path.dirname(temporary), path.resolve(tmpdir()));
  assert.ok(path.basename(temporary).startsWith("localgallery-video-"));
  await rm(temporary, { recursive: true, force: true });
});

function request(parameters = {}, options = {}) {
  return fetch(`${origin}/api/video?${new URLSearchParams({ path: videoName, ...parameters })}`, options);
}

test("includes videos and photos in folder and flat views", async () => {
  const folder = await (await fetch(`${origin}/api/files`)).json();
  assert.equal(folder.items.find((item) => item.name === videoName).mediaType, "video");
  assert.equal(folder.items.find((item) => item.name === "photo.png").mediaType, "image");
  assert.ok(!folder.items.some((item) => item.name === "outside" || item.name === "private.txt"));
  const flat = await (await fetch(`${origin}/api/files?mode=flat`)).json();
  assert.ok(flat.items.some((item) => item.relativePath === "nested/clip.webm" && item.mediaType === "video"));
});

test("streams the unchanged original and advertises byte seeking", async () => {
  const response = await request({ v: version });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "video/mp4");
  assert.equal(response.headers.get("accept-ranges"), "bytes");
  assert.equal(response.headers.get("content-length"), String(source.length));
  assert.equal(response.headers.get("cache-control"), "private, max-age=31536000, immutable");
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), source);
});

for (const [range, start, end] of [
  ["bytes=0-63", 0, 63], ["bytes=100-199", 100, 199],
  ["bytes=100-", 100, null], ["bytes=-32", -32, null], ["bytes=0-999999999999", 0, null],
]) {
  test(`serves the exact requested video bytes for ${range}`, async () => {
    const expected = source.subarray(start, end === null ? undefined : end + 1);
    const response = await request({}, { headers: { Range: range } });
    assert.equal(response.status, 206);
    assert.equal(response.headers.get("content-length"), String(expected.length));
    assert.match(response.headers.get("content-range"), /^bytes \d+-\d+\/\d+$/);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), expected);
  });
}

test("returns 416 for unsatisfiable ranges, including empty videos", async () => {
  for (const range of [`bytes=${source.length}-`, "bytes=20-10", "bytes=-0"]) {
    const response = await request({}, { headers: { Range: range } });
    assert.equal(response.status, 416);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.equal(response.headers.get("content-range"), `bytes */${source.length}`);
  }
  assert.equal((await request({ path: "empty.mp4" }, { headers: { Range: "bytes=0-" } })).status, 416);
  const empty = await request({ path: "empty.mp4" });
  assert.equal(empty.status, 200);
  assert.equal((await empty.arrayBuffer()).byteLength, 0);
});

test("HEAD returns metadata without a video body", async () => {
  const response = await request({}, { method: "HEAD", headers: { Range: "bytes=0-3" } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-length"), String(source.length));
  assert.equal(response.headers.get("accept-ranges"), "bytes");
  assert.equal((await response.arrayBuffer()).byteLength, 0);
});

test("supports conditional responses and If-Range during seeking", async () => {
  const first = await request({}, { method: "HEAD" });
  const etag = first.headers.get("etag");
  const unchanged = await request({}, { headers: { "If-None-Match": etag, Range: "bytes=0-15" } });
  assert.equal(unchanged.status, 304);
  const range = await request({}, { headers: { "If-Range": etag, Range: "bytes=0-15" } });
  assert.equal(range.status, 206);
  assert.deepEqual(Buffer.from(await range.arrayBuffer()), source.subarray(0, 16));
  const changed = await request({}, { headers: { "If-Range": '"outdated"', Range: "bytes=0-15" } });
  assert.equal(changed.status, 200);
  assert.deepEqual(Buffer.from(await changed.arrayBuffer()), source);
});

test("creates and caches actual video poster frames", async () => {
  const response = await request({ size: "thumbnail", width: "80", v: version });
  const body = Buffer.from(await response.arrayBuffer());
  assert.equal(response.status, 200, body.toString());
  assert.equal(response.headers.get("content-type"), "image/webp");
  const metadata = await sharp(body).metadata();
  assert.equal(metadata.width, 80);
  assert.ok(metadata.height > 0 && metadata.height <= 80);
  const repeated = await request({ size: "thumbnail", width: "80", v: version });
  assert.deepEqual(Buffer.from(await repeated.arrayBuffer()), body);
  const unchanged = await request({ size: "thumbnail", width: "80" }, { headers: { "If-None-Match": response.headers.get("etag") } });
  assert.equal(unchanged.status, 304);
});

test("reads duration, dimensions, frame rate, and codec without exposing the absolute path", async () => {
  const response = await request({ size: "info" });
  const info = await response.json();
  assert.equal(response.status, 200);
  assert.equal(info.width, 320);
  assert.equal(info.height, 180);
  assert.ok(info.duration >= 0.9 && info.duration < 1.2);
  assert.equal(info.frameRate, 12);
  assert.equal(info.videoCodec, "h264");
  assert.equal(info.size, source.length);
  assert.equal(info.relativePath, videoName);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.ok(!JSON.stringify(info).includes(temporary));
});

test("serves WebM and extracts its metadata and thumbnail", async () => {
  const response = await request({ path: "nested/clip.webm" }, { method: "HEAD" });
  assert.equal(response.headers.get("content-type"), "video/webm");
  const info = await (await request({ path: "nested/clip.webm", size: "info" })).json();
  assert.equal(info.videoCodec, "vp8");
  const poster = await request({ path: "nested/clip.webm", size: "thumbnail", width: "80" });
  assert.equal(poster.status, 200);
  assert.equal((await sharp(Buffer.from(await poster.arrayBuffer())).metadata()).width, 80);
});

for (const relative of ["../gallery-backup/private.mp4", "..\\gallery-backup\\private.mp4", "outside/private.mp4"]) {
  test(`blocks video access outside the gallery: ${relative}`, async () => {
    for (const size of ["original", "thumbnail", "info"]) assert.equal((await request({ path: relative, size })).status, 403);
  });
}

test("rejects invalid requests and preserves basic details for corrupt videos", async () => {
  assert.equal((await request({ path: "" })).status, 400);
  assert.equal((await request({ path: "photo.png" })).status, 415);
  assert.equal((await request({ path: "private.txt" })).status, 415);
  assert.equal((await request({ path: "missing.mp4" })).status, 404);
  assert.equal((await request({ size: "unknown" })).status, 400);
  for (const width of ["0", "2049", "abc", "2.5"]) assert.equal((await request({ size: "thumbnail", width })).status, 400);
  const info = await (await request({ path: "empty.mp4", size: "info" })).json();
  assert.equal(info.duration, null);
  assert.equal(info.width, null);
  assert.equal(info.name, "empty.mp4");
});
