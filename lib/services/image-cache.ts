import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";

interface CacheOptions {
  memoryBytes?: number;
  diskBytes?: number;
  concurrency?: number;
}

/** Bounded thumbnail cache with atomic disk writes and shared in-flight work. */
export class ThumbnailCache {
  private readonly directory: string;
  private readonly memoryLimit: number;
  private readonly diskLimit: number;
  private readonly concurrency: number;
  private readonly memory = new Map<string, Buffer>();
  private memorySize = 0;
  private readonly inFlight = new Map<string, Promise<Buffer>>();
  private active = 0;
  private readonly waiting: (() => void)[] = [];
  private readonly diskEntries = new Map<string, number>();
  private diskSize = 0;
  private diskAvailable = true;
  private indexReady?: Promise<void>;
  private writes: Promise<void> = Promise.resolve();

  constructor(directory: string, options: CacheOptions = {}) {
    this.directory = directory;
    this.memoryLimit = options.memoryBytes ?? 32 * 1024 * 1024;
    this.diskLimit = options.diskBytes ?? 256 * 1024 * 1024;
    this.concurrency = Math.max(1, options.concurrency ?? 4);
  }

  getOrCreate(key: string, create: () => Promise<Buffer>): Promise<Buffer> {
    if (!/^[a-f0-9]{64}$/.test(key)) throw new Error("Invalid thumbnail cache key");
    const cached = this.memory.get(key);
    if (cached) {
      this.memory.delete(key);
      this.memory.set(key, cached);
      this.touchDiskEntry(key);
      return Promise.resolve(cached);
    }
    const pending = this.inFlight.get(key);
    if (pending) return pending;
    const result = this.loadOrCreate(key, create).finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, result);
    return result;
  }

  private remember(key: string, buffer: Buffer) {
    if (buffer.length > this.memoryLimit) return;
    const previous = this.memory.get(key);
    if (previous) this.memorySize -= previous.length;
    this.memory.delete(key);
    this.memory.set(key, buffer);
    this.memorySize += buffer.length;
    while (this.memorySize > this.memoryLimit) {
      const oldest = this.memory.keys().next().value!;
      this.memorySize -= this.memory.get(oldest)!.length;
      this.memory.delete(oldest);
    }
  }

  private touchDiskEntry(key: string) {
    const size = this.diskEntries.get(key);
    if (size === undefined) return;
    this.diskEntries.delete(key);
    this.diskEntries.set(key, size);
  }

  private async process(create: () => Promise<Buffer>): Promise<Buffer> {
    if (this.active >= this.concurrency) {
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    } else {
      this.active++;
    }
    try {
      return await create();
    } finally {
      const next = this.waiting.shift();
      if (next) next();
      else this.active--;
    }
  }

  private async loadOrCreate(key: string, create: () => Promise<Buffer>): Promise<Buffer> {
    if (this.diskAvailable) {
      try {
        const cached = await readFile(path.join(this.directory, `${key}.webp`));
        if (cached.length) {
          this.remember(key, cached);
          this.touchDiskEntry(key);
          return cached;
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") this.diskAvailable = false;
      }
    }
    const buffer = await this.process(create);
    this.remember(key, buffer);
    if (this.diskAvailable && buffer.length <= this.diskLimit) {
      // Cache storage failures must not prevent an image from being displayed.
      const write = this.writes.then(() => this.store(key, buffer));
      this.writes = write.catch(() => { this.diskAvailable = false; });
      await this.writes;
    }
    return buffer;
  }

  private async initializeIndex() {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const files = (await readdir(this.directory)).filter((name) => /^[a-f0-9]{64}\.webp$/.test(name));
    const entries: { key: string; size: number; modifiedAt: number }[] = [];
    for (let offset = 0; offset < files.length; offset += 32) {
      const batch = await Promise.all(files.slice(offset, offset + 32).map(async (name) => {
        try {
          const stats = await stat(path.join(this.directory, name));
          return stats.isFile() ? { key: name.slice(0, -5), size: stats.size, modifiedAt: stats.mtimeMs } : null;
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
          throw error;
        }
      }));
      for (const entry of batch) if (entry) entries.push(entry);
    }
    entries.sort((a, b) => a.modifiedAt - b.modifiedAt);
    for (const entry of entries) {
      this.diskEntries.set(entry.key, entry.size);
      this.diskSize += entry.size;
    }
  }

  private async store(key: string, buffer: Buffer) {
    if (!this.diskAvailable) return;
    this.indexReady ??= this.initializeIndex();
    await this.indexReady;
    const filename = path.join(this.directory, `${key}.webp`);
    const temporary = path.join(this.directory, `${key}.${randomUUID()}.tmp`);
    try {
      await writeFile(temporary, buffer, { mode: 0o600 });
      await rename(temporary, filename);
    } finally {
      await rm(temporary, { force: true });
    }
    this.diskSize -= this.diskEntries.get(key) ?? 0;
    this.diskEntries.delete(key);
    this.diskEntries.set(key, buffer.length);
    this.diskSize += buffer.length;
    while (this.diskSize > this.diskLimit || this.diskEntries.size > 10000) {
      const oldest = this.diskEntries.keys().next().value!;
      await rm(path.join(this.directory, `${oldest}.webp`), { force: true });
      this.diskSize -= this.diskEntries.get(oldest)!;
      this.diskEntries.delete(oldest);
    }
  }
}

export const thumbnailCache = new ThumbnailCache(
  path.resolve(process.env.LOCAL_GALLERY_CACHE || ".cache/local-gallery"),
);
