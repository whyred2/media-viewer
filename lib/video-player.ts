export const PLAYER_SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;
export const PLAYER_STORAGE_KEY = "localgallery.player.v1";

export interface PlayerPreferences {
  volume: number;
  muted: boolean;
  rate: number;
  lastVolume: number;
}
export interface BufferedRange { start: number; end: number }
export interface PlayerState {
  playing: boolean;
  ended: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  rate: number;
  waiting: boolean;
  buffered: readonly BufferedRange[];
  error: string | null;
  notice: string | null;
}
type StorageLike = Pick<Storage, "getItem" | "setItem">;
const DEFAULT_PREFERENCES: PlayerPreferences = { volume: 0.5, muted: false, rate: 1, lastVolume: 0.5 };
export const INITIAL_PLAYER_STATE: PlayerState = {
  playing: false, ended: false, currentTime: 0, duration: 0,
  volume: 0.5, muted: false, rate: 1, waiting: false, buffered: [], error: null, notice: null,
};
const MEDIA_EVENTS = [
  "loadedmetadata", "durationchange", "timeupdate", "play", "playing", "pause", "ended",
  "waiting", "stalled", "seeking", "seeked", "canplay", "progress", "volumechange", "ratechange", "error", "emptied",
];

export function formatPlayerTime(value: number): string {
  const seconds = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60).toString().padStart(2, "0");
  const remainder = (seconds % 60).toString().padStart(2, "0");
  return hours ? `${hours}:${minutes}:${remainder}` : `${minutes}:${remainder}`;
}

export function clampPlayerTime(value: number, duration: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(duration) || duration <= 0) return 0;
  return Math.max(0, Math.min(duration, value));
}

export function readPlayerPreferences(storage?: StorageLike): PlayerPreferences {
  try {
    const raw = storage?.getItem(PLAYER_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFERENCES };
    const value = JSON.parse(raw);
    if (!value || typeof value !== "object") return { ...DEFAULT_PREFERENCES };
    return {
      volume: typeof value.volume === "number" && Number.isFinite(value.volume) ? Math.max(0, Math.min(1, value.volume)) : 0.5,
      muted: value.muted === true,
      rate: PLAYER_SPEEDS.includes(value.rate) ? value.rate : 1,
      lastVolume: typeof value.lastVolume === "number" && Number.isFinite(value.lastVolume) && value.lastVolume > 0 ? Math.min(1, value.lastVolume) : 0.5,
    };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

function readBuffered(video: HTMLVideoElement, duration: number): BufferedRange[] {
  const result: BufferedRange[] = [];
  try {
    for (let index = 0; index < Math.min(video.buffered.length, 100); index++) {
      const start = Math.max(0, video.buffered.start(index));
      const end = Math.min(duration, video.buffered.end(index));
      if (Number.isFinite(start) && Number.isFinite(end) && end > start) result.push({ start, end });
    }
  } catch { /* buffers may change while a seek is in progress */ }
  return result;
}

/** The media element, rather than optimistic button toggles, owns playback state. */
export class VideoPlayerStore {
  private video: HTMLVideoElement | null = null;
  private state: PlayerState = INITIAL_PLAYER_STATE;
  private readonly listeners = new Set<() => void>();
  private readonly getStorage: () => StorageLike | undefined;
  private lastVolume = 0.5;

  constructor(getStorage: () => StorageLike | undefined = () => typeof window === "undefined" ? undefined : window.localStorage) {
    this.getStorage = getStorage;
  }

  getSnapshot = (): PlayerState => this.state;
  getServerSnapshot = (): PlayerState => INITIAL_PLAYER_STATE;
  getElement = (): HTMLVideoElement | null => this.video;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  private storage(): StorageLike | undefined {
    try { return this.getStorage(); } catch { return undefined; }
  }

  private update(patch: Partial<PlayerState>) {
    const next = { ...this.state, ...patch };
    const sameBuffered = next.buffered.length === this.state.buffered.length && next.buffered.every((range, index) =>
      range.start === this.state.buffered[index].start && range.end === this.state.buffered[index].end
    );
    if (sameBuffered) next.buffered = this.state.buffered;
    if ((Object.keys(next) as (keyof PlayerState)[]).every((key) => next[key] === this.state[key])) return;
    this.state = next;
    for (const listener of this.listeners) listener();
  }

  private save() {
    try {
      this.storage()?.setItem(PLAYER_STORAGE_KEY, JSON.stringify({
        volume: this.state.volume, muted: this.state.muted, rate: this.state.rate, lastVolume: this.lastVolume,
      }));
    } catch { /* playback continues when browser storage is unavailable */ }
  }

  private sync = (event?: Event | string) => {
    const video = this.video;
    if (!video) return;
    const type = typeof event === "string" ? event : event?.type;
    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
    let waiting = this.state.waiting;
    if (["waiting", "stalled", "seeking"].includes(type || "")) waiting = true;
    if (["canplay", "playing", "seeked", "pause", "ended", "error", "emptied"].includes(type || "")) waiting = false;
    if (video.volume > 0) this.lastVolume = video.volume;
    this.update({
      playing: !video.paused && !video.ended,
      ended: video.ended,
      currentTime: clampPlayerTime(video.currentTime, duration), duration,
      volume: video.volume, muted: video.muted, rate: video.playbackRate,
      waiting, buffered: readBuffered(video, duration),
      error: video.error ? (video.error.code === 2 ? "The video could not be loaded. Check the file and try again." : "This video format or codec could not be played.") : null,
      notice: type === "playing" || type === "play" || type === "error" ? null : this.state.notice,
    });
    if (type === "volumechange" || type === "ratechange") this.save();
  };

  attach(video: HTMLVideoElement | null, source: string) {
    this.detach();
    if (!video) return;
    this.video = video;
    this.update(INITIAL_PLAYER_STATE);
    const preferences = readPlayerPreferences(this.storage());
    this.lastVolume = preferences.lastVolume;
    for (const event of MEDIA_EVENTS) video.addEventListener(event, this.sync);
    // React Strict Mode can replay refs after cleanup has removed the source.
    if (!video.getAttribute("src")) video.src = source;
    video.volume = preferences.volume;
    video.muted = preferences.muted;
    video.playbackRate = preferences.rate;
    this.sync();
  }

  detach() {
    const video = this.video;
    if (!video) return;
    this.video = null;
    for (const event of MEDIA_EVENTS) video.removeEventListener(event, this.sync);
    video.pause();
    video.removeAttribute("src");
    video.load();
  }

  async play() {
    const video = this.video;
    if (!video) return;
    this.update({ notice: null });
    try {
      if (video.ended) video.currentTime = 0;
      await video.play();
      if (this.video === video) this.sync();
    } catch (error) {
      if (this.video !== video || (error as DOMException).name === "AbortError") return;
      this.update({ notice: (error as DOMException).name === "NotAllowedError"
        ? "Playback was blocked. Press Play to try again."
        : "Playback could not start. Try again or download the original." });
      this.sync();
    }
  }

  pause() { this.video?.pause(); this.sync(); }
  togglePlayback() { if (this.video?.paused || this.video?.ended) return this.play(); this.pause(); }

  seek(value: number) {
    const video = this.video;
    if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return;
    try { video.currentTime = clampPlayerTime(value, video.duration); this.sync(); }
    catch { this.update({ notice: "This position is not available yet. Try again shortly." }); }
  }

  seekBy(seconds: number) { if (this.video) this.seek(this.video.currentTime + seconds); }

  setVolume(value: number) {
    if (!this.video || !Number.isFinite(value)) return;
    this.video.volume = Math.max(0, Math.min(1, value));
    this.video.muted = this.video.volume === 0;
    this.sync("volumechange");
  }

  toggleMute() {
    const video = this.video;
    if (!video) return;
    if (video.muted || video.volume === 0) {
      if (video.volume === 0) video.volume = this.lastVolume || 0.5;
      video.muted = false;
    } else video.muted = true;
    this.sync("volumechange");
  }

  setRate(value: number) {
    if (!this.video || !(PLAYER_SPEEDS as readonly number[]).includes(value)) return;
    try { this.video.playbackRate = value; this.sync("ratechange"); }
    catch { this.update({ notice: "This playback speed is unavailable." }); }
  }

  retry() {
    if (!this.video) return;
    this.update({ error: null, notice: null });
    this.video.load();
    this.sync("emptied");
  }
}
