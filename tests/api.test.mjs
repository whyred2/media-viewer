import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, mkdir, rm, symlink, utimes, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";

let temporary;
let root;
let server;
let origin;
let original;
let configFile;
let logs = "";

before(
  async () => {
    temporary = await mkdtemp(path.join(tmpdir(), "localgallery-api-"));
    root = path.join(temporary, "gallery");
    const outside = path.join(temporary, "gallery-backup");
    await mkdir(path.join(root, "holiday"), { recursive: true });
    await mkdir(outside);
    original = await sharp({
      create: { width: 120, height: 80, channels: 3, background: "#82b3d1" },
    })
      .png()
      .toBuffer();
    await writeFile(path.join(root, "photo.png"), original);
    const modifiedAt = new Date("2024-01-02T03:04:05.000Z");
    await utimes(path.join(root, "photo.png"), modifiedAt, modifiedAt);
    await writeFile(path.join(root, "holiday", "photo 你好.png"), original);
    await writeFile(path.join(root, "private.txt"), "must not be served");
    await writeFile(path.join(outside, "private.png"), original);
    const linkType = process.platform === "win32" ? "junction" : "dir";
    await symlink(outside, path.join(root, "outside"), linkType);
    await symlink(root, path.join(root, "loop"), linkType);
    configFile = path.join(temporary, "config.json");
    await writeFile(configFile, JSON.stringify({ rootDirectory: root }));

    const portReservation = createServer();
    portReservation.listen(0, "127.0.0.1");
    await once(portReservation, "listening");
    const port = portReservation.address().port;
    await new Promise((resolve) => portReservation.close(resolve));
    origin = `http://127.0.0.1:${port}`;
    server = spawn(
      process.execPath,
      [
        "node_modules/next/dist/bin/next",
        "start",
        "--hostname",
        "127.0.0.1",
        "--port",
        String(port),
      ],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          LOCAL_GALLERY_CONFIG: configFile,
          LOCAL_GALLERY_CACHE: path.join(temporary, "thumbnail-cache"),
          NEXT_TELEMETRY_DISABLED: "1",
        },
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    server.stdout.on("data", (chunk) => {
      logs = (logs + chunk).slice(-16000);
    });
    server.stderr.on("data", (chunk) => {
      logs = (logs + chunk).slice(-16000);
    });
    let startupError;
    server.on("error", (error) => {
      startupError = error;
    });
    for (let attempt = 0; attempt < 200; attempt++) {
      if (startupError) throw startupError;
      if (server.exitCode !== null)
        throw new Error(`Server exited. Run the build first.\n${logs}`);
      try {
        const response = await fetch(`${origin}/api/files`);
        if (response.ok) return;
      } catch {
        /* wait for the server to listen */
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`Server did not become ready.\n${logs}`);
  },
  { timeout: 30000 },
);

after(async () => {
  if (server && server.exitCode === null) {
    const exited = once(server, "exit");
    server.kill();
    await exited;
  }
  if (!temporary) return;
  assert.equal(path.dirname(temporary), path.resolve(tmpdir()));
  assert.ok(path.basename(temporary).startsWith("localgallery-api-"));
  await rm(temporary, { recursive: true, force: true });
});

function request(endpoint, parameters = {}, options = {}) {
  return fetch(`${origin}/api/${endpoint}?${new URLSearchParams(parameters)}`, options);
}

test("lists only gallery folders and images without absolute paths", async () => {
  const response = await request("files");
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(
    body.items.map((item) => item.name),
    ["holiday", "photo.png"],
  );
  for (const item of body.items) {
    assert.equal("path" in item, false);
    assert.equal(path.isAbsolute(item.relativePath), false);
    assert.equal(typeof item.size, "number");
    assert.ok(Number.isFinite(Date.parse(item.modifiedAt)));
    assert.match(item.version, /^[a-f0-9]{24}$/);
  }
  const photo = body.items.find((item) => item.name === "photo.png");
  assert.equal(photo.size, original.length);
  assert.equal(photo.modifiedAt, "2024-01-02T03:04:05.000Z");
});

test("flat mode ignores links and loops and uses portable relative paths", async () => {
  const response = await request("files", { mode: "flat" });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(body.items.map((item) => item.relativePath).sort(), [
    "holiday/photo 你好.png",
    "photo.png",
  ]);
  for (const item of body.items) {
    assert.equal(item.size, original.length);
    assert.ok(Number.isFinite(Date.parse(item.modifiedAt)));
  }
});

for (const relative of [
  "..",
  "../gallery-backup",
  "..\\gallery-backup",
  "outside",
  "/absolute-folder",
]) {
  test(`file listing rejects an escape: ${relative}`, async () => {
    assert.equal((await request("files", { path: relative })).status, 403);
    assert.equal(
      (await request("files", { path: relative, mode: "flat" })).status,
      403,
    );
  });
}

for (const relative of [
  "../gallery-backup/private.png",
  "..\\gallery-backup\\private.png",
  "outside/private.png",
]) {
  test(`image endpoint rejects an escape: ${relative}`, async () => {
    assert.equal(
      (await request("image", { path: relative, size: "original" })).status,
      403,
    );
    assert.equal(
      (await request("image", { path: relative, size: "info" })).status,
      403,
    );
  });
}

test("serves the original image with private cache headers", async () => {
  const response = await request("image", {
    path: "photo.png",
    size: "original",
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/png");
  assert.equal(response.headers.get("cache-control"), "private, no-cache");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), original);
});

test("creates correctly sized WebP thumbnails", async () => {
  const response = await request("image", {
    path: "holiday/photo 你好.png",
    width: "40",
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/webp");
  const metadata = await sharp(
    Buffer.from(await response.arrayBuffer()),
  ).metadata();
  assert.equal(metadata.width, 40);
});

test("rejects non-images, missing images, and invalid view modes", async () => {
  assert.equal(
    (await request("image", { path: "private.txt", size: "original" })).status,
    415,
  );
  assert.equal((await request("image", { path: "missing.png" })).status, 404);
  assert.equal((await request("image")).status, 400);
  assert.equal((await request("files", { mode: "unknown" })).status, 400);
  assert.equal(
    (await request("image", { path: "photo.png", size: "unknown" })).status,
    400,
  );
});

for (const width of [
  "",
  "0",
  "-1",
  "2.5",
  "2049",
  "abc",
  "10pixels",
  "Infinity",
]) {
  test(`rejects invalid thumbnail width ${JSON.stringify(width)}`, async () => {
    assert.equal(
      (await request("image", { path: "photo.png", width })).status,
      400,
    );
  });
}

test("renders the gallery using the runtime configuration", async () => {
  const response = await fetch(origin, { redirect: "manual" });
  assert.equal(response.status, 200);
  assert.match(await response.text(), /Search by filename/);
});

test("returns file information without revealing the absolute path", async () => {
  const response = await request("image", {
    path: "holiday/photo 你好.png",
    size: "info",
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  const info = await response.json();
  assert.equal(info.name, "photo 你好.png");
  assert.equal(info.relativePath, "holiday/photo 你好.png");
  assert.equal(info.size, original.length);
  assert.equal(info.width, 120);
  assert.equal(info.height, 80);
  assert.equal(info.format, "png");
  assert.ok(Number.isFinite(Date.parse(info.modifiedAt)));
  assert.ok(!JSON.stringify(info).includes(temporary));
});

test("renders each parent breadcrumb as an individual link", async () => {
  const response = await fetch(
    `${origin}/?${new URLSearchParams({ path: "holiday/nested folder/deep" })}`,
  );
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /href="\/\?path=holiday"/);
  assert.match(html, /href="\/\?path=holiday%2Fnested\+folder"/);
  assert.match(html, /aria-current="page"[^>]*>deep<\/span>/);
});

test("preserves sorting in breadcrumb links and renders the selected direction", async () => {
  const query = new URLSearchParams({ path: "holiday/nested/deep", sort: "size", order: "desc" });
  const response = await fetch(`${origin}/?${query}`);
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /href="\/\?sort=size&amp;order=desc"/);
  assert.match(html, /href="\/\?path=holiday&amp;sort=size&amp;order=desc"/);
  assert.match(html, /aria-label="Sort by size"/);
  assert.match(html, /Descending order\. Switch to ascending/);
});

test("file information respects EXIF orientation", async () => {
  const filename = path.join(root, "oriented.jpg");
  try {
    await writeFile(
      filename,
      await sharp(original).withMetadata({ orientation: 6 }).jpeg().toBuffer(),
    );
    const response = await request("image", {
      path: "oriented.jpg",
      size: "info",
    });
    assert.equal(response.status, 200);
    const info = await response.json();
    assert.equal(info.width, 80);
    assert.equal(info.height, 120);
    const thumbnail = await request("image", { path: "oriented.jpg", width: "40" });
    const metadata = await sharp(Buffer.from(await thumbnail.arrayBuffer())).metadata();
    assert.equal(metadata.width, 40);
    assert.equal(metadata.height, 60);
  } finally {
    await rm(filename, { force: true });
  }
});

test("still returns basic file information for an undecodable image", async () => {
  const filename = path.join(root, "broken.png");
  try {
    await writeFile(filename, "not an image");
    const response = await request("image", {
      path: "broken.png",
      size: "info",
    });
    assert.equal(response.status, 200);
    const info = await response.json();
    assert.equal(info.width, null);
    assert.equal(info.height, null);
    assert.equal(info.size, 12);
    assert.equal(info.format, "png");
  } finally {
    await rm(filename, { force: true });
  }
});

test("reloads configuration at runtime and opens setup when the root is unset", async () => {
  try {
    await writeFile(configFile, JSON.stringify({ rootDirectory: null }));
    const response = await fetch(origin, { redirect: "manual" });
    assert.equal(response.status, 307);
    assert.equal(response.headers.get("location"), "/setup");
    assert.equal((await request("files")).status, 400);
    assert.equal(
      (await request("image", { path: "photo.png", size: "info" })).status,
      400,
    );
  } finally {
    await writeFile(configFile, JSON.stringify({ rootDirectory: root }));
  }
});

test("versioned thumbnails are reusable and return 304 for an unchanged source", async () => {
  const listing = await (await request("files")).json();
  const photo = listing.items.find((item) => item.name === "photo.png");
  const parameters = { path: photo.relativePath, size: "thumbnail", width: "40", v: photo.version };
  const response = await request("image", parameters);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, max-age=31536000, immutable");
  assert.equal(response.headers.get("last-modified"), "Tue, 02 Jan 2024 03:04:05 GMT");
  const etag = response.headers.get("etag");
  assert.ok(etag);
  const first = Buffer.from(await response.arrayBuffer());
  assert.ok(first.length > 0);
  const cached = await request("image", parameters);
  assert.deepEqual(Buffer.from(await cached.arrayBuffer()), first);
  const unchanged = await request("image", parameters, { headers: { "If-None-Match": `"unrelated", ${etag.replace(/^W\//, "")}` } });
  assert.equal(unchanged.status, 304);
  assert.equal((await unchanged.arrayBuffer()).byteLength, 0);
  assert.equal(unchanged.headers.get("etag"), etag);
});

test("original images support conditional requests without transferring the file again", async () => {
  const response = await request("image", { path: "photo.png", size: "original" });
  const etag = response.headers.get("etag");
  assert.ok(etag);
  assert.equal(response.headers.get("content-length"), String(original.length));
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), original);
  const unchanged = await request("image", { path: "photo.png", size: "original" }, { headers: { "If-None-Match": etag } });
  assert.equal(unchanged.status, 304);
  assert.equal((await unchanged.arrayBuffer()).byteLength, 0);
});

test("invalidates cached thumbnails when an image changes and rejects deleted sources", async () => {
  const filename = path.join(root, "mutable.png");
  try {
    await writeFile(filename, original);
    const initial = (await (await request("files")).json()).items.find((item) => item.name === "mutable.png");
    const parameters = { path: "mutable.png", width: "40", v: initial.version };
    const first = await request("image", parameters);
    const etag = first.headers.get("etag");
    const firstBuffer = Buffer.from(await first.arrayBuffer());
    const replacement = await sharp({ create: { width: 120, height: 80, channels: 3, background: "#e35b46" } }).png().toBuffer();
    await writeFile(filename, replacement);
    const oldUrl = await request("image", parameters, { headers: { "If-None-Match": etag } });
    assert.equal(oldUrl.status, 200);
    assert.notEqual(oldUrl.headers.get("etag"), etag);
    assert.equal(oldUrl.headers.get("cache-control"), "private, no-cache");
    assert.notDeepEqual(Buffer.from(await oldUrl.arrayBuffer()), firstBuffer);
    const updated = (await (await request("files")).json()).items.find((item) => item.name === "mutable.png");
    assert.notEqual(updated.version, initial.version);
    const current = await request("image", { ...parameters, v: updated.version });
    assert.equal(current.headers.get("cache-control"), "private, max-age=31536000, immutable");
    const currentEtag = current.headers.get("etag");
    await current.arrayBuffer();
    await rm(filename);
    assert.equal((await request("image", { ...parameters, v: updated.version }, { headers: { "If-None-Match": currentEtag } })).status, 404);
  } finally {
    await rm(filename, { force: true });
  }
});

test("does not reuse an old gallery's cache identity after changing the root", async () => {
  const listing = await (await request("files")).json();
  const photo = listing.items.find((item) => item.name === "photo.png");
  const parameters = { path: "photo.png", width: "40", v: photo.version };
  const first = await request("image", parameters);
  const etag = first.headers.get("etag");
  await first.arrayBuffer();
  const otherRoot = path.join(temporary, "another-gallery");
  await mkdir(otherRoot);
  await writeFile(path.join(otherRoot, "photo.png"), original);
  const date = new Date("2024-01-02T03:04:05.000Z");
  await utimes(path.join(otherRoot, "photo.png"), date, date);
  try {
    await writeFile(configFile, JSON.stringify({ rootDirectory: otherRoot }));
    const response = await request("image", parameters, { headers: { "If-None-Match": etag } });
    assert.equal(response.status, 200);
    assert.notEqual(response.headers.get("etag"), etag);
    assert.equal(response.headers.get("cache-control"), "private, no-cache");
    await response.arrayBuffer();
  } finally {
    await writeFile(configFile, JSON.stringify({ rootDirectory: root }));
  }
});
