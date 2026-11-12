import assert from "node:assert/strict";
import { test } from "node:test";
import { clampPlayerTime, formatPlayerTime, PLAYER_STORAGE_KEY, readPlayerPreferences, VideoPlayerStore } from "../lib/video-player.ts";

class FakeVideo extends EventTarget {
  src = "clip.mp4";
  paused = true;
  ended = false;
  duration = 120;
  volume = 0.5;
  muted = false;
  playbackRate = 1;
  error = null;
  buffered = { length: 0, start: () => 0, end: () => 0 };
  time = 0;
  seekWrites = [];
  playFailure = null;
  pauseCalls = 0;
  loadCalls = 0;
  get currentTime() { return this.time; }
  set currentTime(value) {
    assert.ok(Number.isFinite(value) && value >= 0 && value <= this.duration);
    this.seekWrites.push(value);
    this.time = value;
  }
  getAttribute(name) { return name === "src" ? this.src || null : null; }
  removeAttribute(name) { if (name === "src") this.src = ""; }
  emit(type) { this.dispatchEvent(new Event(type)); }
  async play() {
    if (this.playFailure) throw this.playFailure;
    this.paused = false;
    this.ended = false;
    this.emit("play");
    this.emit("playing");
  }
  pause() { this.pauseCalls++; this.paused = true; this.emit("pause"); }
  load() { this.loadCalls++; this.paused = true; this.error = null; this.time = 0; this.duration = 0; this.emit("emptied"); }
}

function setup(raw) {
  const entries = new Map(raw === undefined ? [] : [[PLAYER_STORAGE_KEY, raw]]);
  const storage = { getItem: (key) => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value) };
  const store = new VideoPlayerStore(() => storage);
  const video = new FakeVideo();
  store.attach(video, "clip.mp4");
  return { store, video, entries };
}

test("formats long and unknown durations without NaN or Infinity", () => {
  assert.equal(formatPlayerTime(3661.9), "1:01:01");
  assert.equal(formatPlayerTime(125), "02:05");
  for (const value of [NaN, Infinity, -10]) assert.equal(formatPlayerTime(value), "00:00");
});

test("validates preferences and tolerates unavailable or corrupt storage", () => {
  for (const raw of ["not json", "null", "[]"]) {
    const preferences = readPlayerPreferences({ getItem: () => raw });
    assert.equal(preferences.rate, 1);
    assert.equal(preferences.volume, 0.5);
  }
  const preferences = readPlayerPreferences({ getItem: () => JSON.stringify({ volume: 200, rate: -5, muted: "yes", lastVolume: -1 }) });
  assert.equal(preferences.volume, 1);
  assert.equal(preferences.rate, 1);
  assert.equal(preferences.muted, false);
  assert.doesNotThrow(() => readPlayerPreferences({ getItem() { throw new Error("storage blocked"); } }));
});

test("follows actual play, pause, and ended events", async () => {
  const { store, video } = setup();
  await store.togglePlayback();
  assert.equal(store.getSnapshot().playing, true);
  video.paused = true;
  video.emit("pause");
  assert.equal(store.getSnapshot().playing, false);
  video.ended = true;
  video.emit("ended");
  assert.equal(store.getSnapshot().ended, true);
  await store.play();
  assert.equal(video.currentTime, 0);
  assert.equal(store.getSnapshot().playing, true);
  store.detach();
});

test("does not claim playback started after a rejected play promise", async () => {
  const { store, video } = setup();
  video.playFailure = new DOMException("blocked", "NotAllowedError");
  await store.play();
  assert.equal(store.getSnapshot().playing, false);
  assert.match(store.getSnapshot().notice, /blocked/i);
  video.playFailure = null;
  await store.play();
  assert.equal(store.getSnapshot().playing, true);
  assert.equal(store.getSnapshot().notice, null);
  store.detach();
});

test("restores muted settings and remembers the last audible volume", () => {
  const { store, video, entries } = setup(JSON.stringify({ volume: 0.7, muted: true, rate: 1.5, lastVolume: 0.7 }));
  assert.equal(video.muted, true);
  assert.equal(video.volume, 0.7);
  assert.equal(video.playbackRate, 1.5);
  store.toggleMute();
  assert.equal(video.muted, false);
  assert.equal(video.volume, 0.7);
  store.setVolume(0);
  assert.equal(video.muted, true);
  store.toggleMute();
  assert.equal(video.volume, 0.7);
  assert.equal(video.muted, false);
  assert.equal(JSON.parse(entries.get(PLAYER_STORAGE_KEY)).muted, false);
  store.detach();
});

test("seeks only to valid positions and refuses unknown durations", () => {
  const { store, video } = setup();
  store.seek(-20);
  store.seek(1000);
  assert.deepEqual(video.seekWrites, [0, 120]);
  video.duration = Infinity;
  store.seek(10);
  assert.deepEqual(video.seekWrites, [0, 120]);
  assert.equal(clampPlayerTime(NaN, 100), 0);
  store.detach();
});

test("uses independent state for buffering, fatal errors, and retries", () => {
  const { store, video } = setup();
  video.emit("waiting");
  assert.equal(store.getSnapshot().waiting, true);
  video.emit("canplay");
  assert.equal(store.getSnapshot().waiting, false);
  video.error = { code: 4 };
  video.emit("error");
  assert.match(store.getSnapshot().error, /codec/);
  store.retry();
  assert.equal(video.loadCalls, 1);
  assert.equal(store.getSnapshot().error, null);
  store.detach();
});

test("cleans up playback and tolerates Strict Mode ref replay", async () => {
  const { store, video } = setup();
  await store.play();
  store.attach(null, "clip.mp4");
  assert.equal(video.paused, true);
  assert.equal(video.src, "");
  store.attach(video, "clip.mp4");
  assert.equal(video.src, "clip.mp4");
  assert.equal(store.getSnapshot().playing, false);
  video.duration = 60;
  video.emit("loadedmetadata");
  assert.equal(store.getSnapshot().duration, 60);
  store.detach();
});

test("ignores old playback rejections after switching to another file", async () => {
  const { store, video } = setup();
  let reject;
  video.play = () => new Promise((resolve, rejectPromise) => { reject = rejectPromise; });
  const pending = store.play();
  const next = new FakeVideo();
  store.attach(next, "next.mp4");
  reject(new DOMException("blocked", "NotAllowedError"));
  await pending;
  assert.equal(store.getSnapshot().notice, null);
  store.detach();
});

test("preference writes do not break playback when browser storage is blocked", () => {
  const store = new VideoPlayerStore(() => ({ getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } }));
  const video = new FakeVideo();
  store.attach(video, "clip.mp4");
  assert.doesNotThrow(() => { store.setVolume(0.2); store.setRate(1.5); store.toggleMute(); });
  assert.equal(video.playbackRate, 1.5);
  store.detach();
});
