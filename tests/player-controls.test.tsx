import { testWindow } from "./dom-setup.mjs";
import assert from "node:assert/strict";
import { beforeEach, afterEach, after, test } from "node:test";
import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { VideoPlayer } from "../components/player-handler";
import { PLAYER_STORAGE_KEY } from "../lib/video-player";

interface MockMediaState {
  paused: boolean; ended: boolean; duration: number; currentTime: number;
  volume: number; muted: boolean; playbackRate: number; error: { code: number } | null;
  seekWrites: number[]; playFailure: Error | null; pauseCalls: number; loadCalls: number;
}
const mediaStates = new WeakMap<HTMLMediaElement, MockMediaState>();
function mediaState(element: HTMLMediaElement): MockMediaState {
  let value = mediaStates.get(element);
  if (!value) {
    value = { paused: true, ended: false, duration: 120, currentTime: 0, volume: 0.5, muted: false, playbackRate: 1, error: null, seekWrites: [], playFailure: null, pauseCalls: 0, loadCalls: 0 };
    mediaStates.set(element, value);
  }
  return value;
}
for (const key of ["paused", "ended", "duration", "volume", "muted", "playbackRate", "error"] as const) {
  Object.defineProperty(HTMLMediaElement.prototype, key, {
    configurable: true,
    get() { return mediaState(this)[key]; },
    set(value) { Object.assign(mediaState(this), { [key]: value }); },
  });
}
Object.defineProperty(HTMLMediaElement.prototype, "buffered", { configurable: true, get: () => ({ length: 0 }) });
Object.defineProperty(HTMLMediaElement.prototype, "currentTime", {
  configurable: true,
  get() { return mediaState(this).currentTime; },
  set(value) { const state = mediaState(this); state.currentTime = value; state.seekWrites.push(value); },
});
HTMLMediaElement.prototype.play = async function () {
  const state = mediaState(this);
  if (state.playFailure) throw state.playFailure;
  state.paused = false;
  state.ended = false;
  this.dispatchEvent(new Event("play"));
  this.dispatchEvent(new Event("playing"));
};
HTMLMediaElement.prototype.pause = function () {
  const state = mediaState(this);
  state.pauseCalls++;
  state.paused = true;
  this.dispatchEvent(new Event("pause"));
};
HTMLMediaElement.prototype.load = function () {
  const state = mediaState(this);
  state.loadCalls++;
  state.error = null;
  state.paused = true;
  state.currentTime = 0;
  this.dispatchEvent(new Event("emptied"));
};

let root: Root;
let container: HTMLDivElement;
let playerWidth = 800;
let fullscreenElement: Element | null = null;
let fullscreenFailure = false;
Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get() { return this.hasAttribute("data-video-player") ? playerWidth : 0; } });
Object.defineProperty(document, "fullscreenElement", { configurable: true, get: () => fullscreenElement });
function enterFullscreen(target: Element) {
  fullscreenElement = target;
  document.dispatchEvent(new Event("fullscreenchange"));
}
HTMLElement.prototype.requestFullscreen = async function () {
  if (fullscreenFailure) throw new Error("Fullscreen denied");
  enterFullscreen(this);
};
document.exitFullscreen = async () => {
  fullscreenElement = null;
  document.dispatchEvent(new Event("fullscreenchange"));
};
beforeEach(() => {
  window.localStorage.clear();
  playerWidth = 800;
  fullscreenElement = null;
  fullscreenFailure = false;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});
after(async () => { await testWindow.happyDOM.abort(); });

async function mount(url = "/clip.mp4", strict = false) {
  await act(async () => root.render(strict ? <StrictMode><VideoPlayer url={url} name="Test clip" /></StrictMode> : <VideoPlayer url={url} name="Test clip" />));
  return container.querySelector("video")!;
}
function button(label: string) {
  const result = container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  assert.ok(result, `Missing button: ${label}`);
  return result;
}
async function click(element: Element) {
  await act(async () => { element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); });
}
async function key(element: Element, key: string, code = key) {
  const event = new KeyboardEvent("keydown", { key, code, bubbles: true, cancelable: true });
  await act(async () => { element.dispatchEvent(event); });
  return event;
}
async function flushFocus() {
  await act(async () => { await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve())); });
}

test("provides custom accessible controls without native video chrome", async () => {
  const video = await mount();
  assert.equal(video.hasAttribute("controls"), false);
  assert.ok(button("Play"));
  assert.ok(container.querySelector('[role="slider"][aria-label="Seek video"]'));
  assert.ok(container.querySelector('[role="slider"][aria-label="Volume"]'));
  await click(button("Play"));
  assert.equal(mediaState(video).paused, false);
  assert.ok(button("Pause"));
  await click(button("Pause"));
  assert.equal(mediaState(video).paused, true);
});

test("shows rejected playback without incorrectly switching to Pause", async () => {
  const video = await mount();
  mediaState(video).playFailure = new DOMException("blocked", "NotAllowedError");
  await click(button("Play"));
  assert.ok(button("Play"));
  assert.match(container.textContent!, /Playback was blocked/);
});

test("restores mute and speed, and saves an audible volume when unmuting", async () => {
  localStorage.setItem(PLAYER_STORAGE_KEY, JSON.stringify({ volume: 0.7, muted: true, rate: 1.5, lastVolume: 0.7 }));
  const video = await mount();
  assert.equal(mediaState(video).muted, true);
  assert.equal(mediaState(video).playbackRate, 1.5);
  await click(button("Unmute"));
  assert.equal(mediaState(video).muted, false);
  assert.equal(mediaState(video).volume, 0.7);
  assert.equal(JSON.parse(localStorage.getItem(PLAYER_STORAGE_KEY)!).muted, false);
});

test("seeks with root keyboard shortcuts without bubbling into gallery navigation", async () => {
  const video = await mount();
  const player = container.querySelector<HTMLElement>("[data-video-player]")!;
  let galleryEvents = 0;
  const listener = () => { galleryEvents++; };
  window.addEventListener("keydown", listener);
  try {
    await key(player, "ArrowRight");
    assert.equal(video.currentTime, 5);
    assert.equal(galleryEvents, 0);
    await key(player, "End");
    assert.equal(video.currentTime, 120);
    await key(player, "ArrowRight");
    assert.equal(video.currentTime, 120);
  } finally { window.removeEventListener("keydown", listener); }
});

test("supports keyboard seek slider commits without pausing or getting stuck in drag mode", async () => {
  const video = await mount();
  await click(button("Play"));
  const seek = container.querySelector<HTMLElement>('[role="slider"][aria-label="Seek video"]')!;
  await key(seek, "ArrowRight");
  assert.ok(video.currentTime > 0);
  assert.equal(mediaState(video).paused, false);
  assert.equal(mediaState(video).seekWrites.length, 1);
});

test("previews pointer scrubbing and only seeks once after release", async () => {
  const video = await mount();
  await click(button("Play"));
  const seek = container.querySelector<HTMLElement>('[role="slider"][aria-label="Seek video"]')!;
  const slider = seek.closest<HTMLElement>("[data-player-slider]")!;
  slider.getBoundingClientRect = () => ({ x: 0, y: 0, width: 100, height: 20, top: 0, right: 100, bottom: 20, left: 0, toJSON() {} });
  await act(async () => slider.dispatchEvent(new PointerEvent("pointerdown", { pointerId: 1, button: 0, clientX: 20, bubbles: true, cancelable: true })));
  await act(async () => slider.dispatchEvent(new PointerEvent("pointermove", { pointerId: 1, clientX: 70, bubbles: true, cancelable: true })));
  assert.equal(mediaState(video).seekWrites.length, 0);
  assert.equal(mediaState(video).paused, true);
  await act(async () => slider.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1, clientX: 70, bubbles: true, cancelable: true })));
  assert.equal(mediaState(video).seekWrites.length, 1);
  assert.ok(video.currentTime > 80 && video.currentTime < 85);
  assert.equal(mediaState(video).paused, false);
});

test("survives Strict Mode and releases the old source on navigation", async () => {
  const first = await mount("/first.mp4", true);
  assert.match(first.src, /first\.mp4$/);
  await click(button("Play"));
  const second = await mount("/second.mp4", true);
  assert.match(second.src, /second\.mp4$/);
  assert.equal(mediaState(second).paused, true);
  assert.equal(mediaState(first).paused, true);
  assert.ok(mediaState(first).loadCalls > 0);
});

test("opens sliding settings inside the player and keeps both panels available on wide screens", async () => {
  const video = await mount();
  const player = container.querySelector<HTMLElement>("[data-video-player]")!;
  const main = container.querySelector<HTMLElement>('[data-settings-panel="main"]')!;
  const speeds = container.querySelector<HTMLElement>('[data-settings-panel="speed"]')!;
  assert.equal(main.inert, true);
  assert.equal(speeds.inert, true);
  await click(button("Player settings"));
  await flushFocus();
  assert.ok(player.querySelector('[data-player-settings-open="true"][data-settings-layout="side-by-side"]'));
  assert.equal(main.inert, false);
  assert.equal(speeds.inert, true);
  const speedTrigger = main.querySelector("button")!;
  assert.equal(document.activeElement, speedTrigger);
  await key(speedTrigger, "ArrowRight");
  await flushFocus();
  assert.equal(main.inert, false);
  assert.equal(speeds.inert, false);
  const selected = speeds.querySelector<HTMLInputElement>('input[value="1.5"]')!;
  await act(async () => { selected.click(); });
  assert.equal(video.playbackRate, 1.5);
  assert.equal(selected.checked, true);
  assert.equal(JSON.parse(localStorage.getItem(PLAYER_STORAGE_KEY)!).rate, 1.5);
  assert.equal(speeds.inert, false);
  assert.match(main.textContent!, /1.5x/);
});

test("uses one sliding panel at a time in a narrow player with a working back button", async () => {
  playerWidth = 320;
  await mount();
  await click(button("Player settings"));
  const main = container.querySelector<HTMLElement>('[data-settings-panel="main"]')!;
  const speeds = container.querySelector<HTMLElement>('[data-settings-panel="speed"]')!;
  await click(main.querySelector("button")!);
  assert.ok(container.querySelector('[data-settings-layout="single-panel"]'));
  assert.equal(main.inert, true);
  assert.equal(speeds.inert, false);
  await click(button("Back to player settings"));
  await flushFocus();
  assert.equal(main.inert, false);
  assert.equal(speeds.inert, true);
  assert.equal(document.activeElement, main.querySelector("button"));
});

test("Escape backs out of speed settings before closing and restoring focus without reaching the gallery", async () => {
  await mount();
  const trigger = button("Player settings");
  await click(trigger);
  const main = container.querySelector<HTMLElement>('[data-settings-panel="main"]')!;
  const speeds = container.querySelector<HTMLElement>('[data-settings-panel="speed"]')!;
  await click(main.querySelector("button")!);
  await flushFocus();
  let galleryEvents = 0;
  const listener = () => { galleryEvents++; };
  window.addEventListener("keydown", listener);
  try {
    const event = await key(speeds.querySelector("input:checked")!, "Escape");
    await flushFocus();
    assert.equal(event.defaultPrevented, true);
    assert.equal(speeds.inert, true);
    assert.equal(trigger.getAttribute("aria-expanded"), "true");
    assert.equal(document.activeElement, main.querySelector("button"));
    await key(main.querySelector("button")!, "Escape");
    assert.equal(trigger.getAttribute("aria-expanded"), "false");
    assert.equal(document.activeElement, trigger);
    assert.equal(main.inert, true);
    assert.equal(galleryEvents, 0);
  } finally { window.removeEventListener("keydown", listener); }
});

test("dismissing settings by clicking the video does not also change playback", async () => {
  const video = await mount();
  await click(button("Player settings"));
  await act(async () => { video.dispatchEvent(new PointerEvent("pointerdown", { pointerId: 2, button: 0, bubbles: true, cancelable: true })); });
  await click(video);
  await act(async () => { await new Promise((resolve) => window.setTimeout(resolve, 230)); });
  assert.equal(button("Player settings").getAttribute("aria-expanded"), "false");
  assert.equal(mediaState(video).paused, true);
});

test("enters fullscreen on the player container, retains its sliding settings, and exits correctly", async () => {
  await mount();
  const player = container.querySelector<HTMLElement>("[data-video-player]")!;
  await click(button("Fullscreen"));
  assert.equal(document.fullscreenElement, player);
  assert.equal(player.getAttribute("data-player-fullscreen"), "true");
  await click(button("Player settings"));
  assert.ok(player.querySelector('[data-player-settings-open="true"]'));
  await click(button("Exit fullscreen"));
  assert.equal(document.fullscreenElement, null);
  assert.equal(player.hasAttribute("data-player-fullscreen"), false);
});

test("shows fullscreen rejection without hiding the working controls", async () => {
  fullscreenFailure = true;
  await mount();
  await click(button("Fullscreen"));
  assert.equal(document.fullscreenElement, null);
  assert.match(container.textContent!, /Fullscreen is unavailable/);
  assert.equal(button("Play").disabled, false);
});
