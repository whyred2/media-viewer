"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Expand, Film, Loader2, Pause, PictureInPicture2, Play, RotateCcw, Shrink, Volume1, Volume2, VolumeX } from "lucide-react";
import { PlayerButton, PlayerControlGroup, PlayerSlider } from "@/components/ui/video";
import { PlayerSettings } from "@/components/player-settings";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { clampPlayerTime, formatPlayerTime, VideoPlayerStore } from "@/lib/video-player";

type WebkitVideo = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void;
  webkitDisplayingFullscreen?: boolean;
};

interface VideoPlayerProps { url: string; poster?: string; name?: string }

/** Adapted from the portfolio player, retaining its glass controls and speed menu. */
export function VideoPlayer({ url, poster, name = "Video" }: VideoPlayerProps) {
  const [store] = useState(() => new VideoPlayerStore());
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [controlsHidden, setControlsHidden] = useState(false);
  const [keyboardMode, setKeyboardMode] = useState(false);
  const [controlsFocused, setControlsFocused] = useState(false);
  const [scrubTime, setScrubTime] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const scrub = useRef<{ initial: number; preview: number; resume: boolean } | null>(null);
  const keyboardSeek = useRef(false);
  const hideTimer = useRef<number | null>(null);
  const clickTimer = useRef<number | null>(null);
  const ignoreVideoClick = useRef(false);
  const isScrubbing = scrubTime !== null;

  const attachVideo = useCallback((video: HTMLVideoElement | null) => store.attach(video, url), [store, url]);
  const subscribeDisplay = useCallback((notify: () => void) => {
    if (!root) return () => {};
    const video = store.getElement();
    const doc = root.ownerDocument;
    doc.addEventListener("fullscreenchange", notify);
    for (const event of ["webkitbeginfullscreen", "webkitendfullscreen", "enterpictureinpicture", "leavepictureinpicture"]) video?.addEventListener(event, notify);
    return () => {
      doc.removeEventListener("fullscreenchange", notify);
      for (const event of ["webkitbeginfullscreen", "webkitendfullscreen", "enterpictureinpicture", "leavepictureinpicture"]) video?.removeEventListener(event, notify);
    };
  }, [root, store]);
  const getDisplaySnapshot = useCallback(() => {
    if (!root) return "0000";
    const doc = root.ownerDocument;
    const video = store.getElement() as WebkitVideo | null;
    return [
      typeof root.requestFullscreen === "function" || typeof video?.webkitEnterFullscreen === "function",
      !!doc.pictureInPictureEnabled && typeof video?.requestPictureInPicture === "function",
      doc.fullscreenElement === root || !!video?.webkitDisplayingFullscreen,
      !!video && doc.pictureInPictureElement === video,
    ].map(Number).join("");
  }, [root, store]);
  const display = useSyncExternalStore(subscribeDisplay, getDisplaySnapshot, () => "0000");
  const canFullscreen = display[0] === "1";
  const canPip = display[1] === "1";
  const fullscreen = display[2] === "1";
  const pip = display[3] === "1";

  const clearHideTimer = useCallback(() => {
    if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
    hideTimer.current = null;
  }, []);
  const canHide = state.playing && !state.waiting && !state.error && !isScrubbing && !settingsOpen && !(keyboardMode && controlsFocused);
  const hideControls = useCallback(() => {
    const focused = root?.ownerDocument.activeElement;
    if (root && focused && root.contains(focused) && focused.closest("[data-player-controls]")) root.focus({ preventScroll: true });
    setControlsHidden(true);
  }, [root]);
  const scheduleHide = useCallback(() => {
    clearHideTimer();
    if (canHide) hideTimer.current = window.setTimeout(hideControls, 2200);
  }, [canHide, clearHideTimer, hideControls]);
  const revealControls = useCallback(() => {
    setControlsHidden(false);
    scheduleHide();
  }, [scheduleHide]);
  const visible = !controlsHidden || !canHide;

  useEffect(() => { scheduleHide(); return clearHideTimer; }, [scheduleHide, clearHideTimer]);
  useEffect(() => {
    if (!root) return;
    const frame = window.requestAnimationFrame(() => {
      if (!root.contains(root.ownerDocument.activeElement)) root.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [root]);
  useEffect(() => () => {
    if (clickTimer.current !== null) window.clearTimeout(clickTimer.current);
  }, []);
  useEffect(() => {
    const video = store.getElement();
    return () => {
      if (video && document.pictureInPictureElement === video) void document.exitPictureInPicture().catch(() => {});
    };
  }, [store]);

  const toggleFullscreen = async () => {
    if (!root) return;
    setNotice(null);
    try {
      if (root.ownerDocument.fullscreenElement === root) await root.ownerDocument.exitFullscreen();
      else if (root.requestFullscreen) await root.requestFullscreen();
      else (store.getElement() as WebkitVideo | null)?.webkitEnterFullscreen?.();
    } catch { setNotice("Fullscreen is unavailable. You can keep watching here."); }
  };
  const togglePip = async () => {
    const video = store.getElement();
    if (!video) return;
    setNotice(null);
    try {
      if (document.pictureInPictureElement === video) await document.exitPictureInPicture();
      else await video.requestPictureInPicture();
    } catch { setNotice("Picture-in-picture is unavailable for this video."); }
  };

  const previewSeek = (values: number[]) => {
    if (keyboardSeek.current) return;
    const video = store.getElement();
    if (!video || !state.duration) return;
    const preview = clampPlayerTime(values[0], state.duration);
    if (!scrub.current) {
      scrub.current = { initial: video.currentTime, preview, resume: !video.paused && !video.ended };
      store.pause();
    }
    scrub.current.preview = preview;
    setScrubTime(preview);
    revealControls();
  };
  const finishSeek = (values: number[], cancelled = false) => {
    // Radix commits keyboard steps before emitting onValueChange.
    if (keyboardSeek.current && !cancelled) { store.seek(values[0]); return; }
    const interaction = scrub.current;
    if (!interaction) return;
    const target = cancelled ? interaction.initial : clampPlayerTime(values[0], state.duration);
    scrub.current = null;
    setScrubTime(null);
    if (!cancelled) store.seek(target);
    if (interaction.resume && target < state.duration) void store.play();
    revealControls();
  };

  const playOnClick = (event: React.MouseEvent<HTMLVideoElement>) => {
    root?.focus({ preventScroll: true });
    if (clickTimer.current !== null) window.clearTimeout(clickTimer.current);
    if (ignoreVideoClick.current) { ignoreVideoClick.current = false; revealControls(); return; }
    if (event.detail > 1) return;
    clickTimer.current = window.setTimeout(() => { void store.togglePlayback(); }, 200);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    setKeyboardMode(true);
    revealControls();
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target as HTMLElement;
    if (target.closest("button, a, input, textarea, select, [role=slider], [role=menu], [contenteditable=true]")) return;
    switch (event.code) {
      case "Space": case "KeyK": event.preventDefault(); event.stopPropagation(); void store.togglePlayback(); break;
      case "ArrowLeft": case "KeyJ": event.preventDefault(); event.stopPropagation(); store.seekBy(-5); break;
      case "ArrowRight": case "KeyL": event.preventDefault(); event.stopPropagation(); store.seekBy(5); break;
      case "ArrowUp": event.preventDefault(); event.stopPropagation(); store.setVolume(state.volume + 0.05); break;
      case "ArrowDown": event.preventDefault(); event.stopPropagation(); store.setVolume(state.volume - 0.05); break;
      case "KeyM": event.preventDefault(); event.stopPropagation(); store.toggleMute(); break;
      case "KeyF": event.preventDefault(); event.stopPropagation(); void toggleFullscreen(); break;
      case "Home": event.preventDefault(); event.stopPropagation(); store.seek(0); break;
      case "End": event.preventDefault(); event.stopPropagation(); store.seek(state.duration); break;
    }
  };

  const currentTime = scrubTime ?? state.currentTime;
  const silent = state.muted || state.volume === 0;
  return (
    <div ref={setRoot} data-video-player="" data-player-fullscreen={fullscreen || undefined}
      role="region" aria-label={`Video player: ${name}`} tabIndex={0}
      className={cn("relative mx-auto flex h-full min-h-0 w-full items-center justify-center overflow-hidden rounded-lg bg-black outline-none", !visible && "cursor-none")}
      onPointerMove={revealControls}
      onPointerDownCapture={(event) => { ignoreVideoClick.current = settingsOpen || (event.pointerType === "touch" && !visible); setKeyboardMode(false); revealControls(); }}
      onPointerLeave={() => { if (canHide) hideControls(); }}
      onFocusCapture={(event) => setControlsFocused(!!(event.target as HTMLElement).closest("[data-player-controls], [data-player-menu]"))}
      onBlurCapture={(event) => setControlsFocused(!!(event.relatedTarget as HTMLElement | null)?.closest?.("[data-player-controls], [data-player-menu]"))}
      onKeyDown={handleKeyDown}
    >
      <video ref={attachVideo} src={url} poster={poster} preload="metadata" playsInline aria-label={name}
        className={cn("max-h-full max-w-full object-contain", state.error && "hidden")}
        onClick={playOnClick}
        onDoubleClick={() => { if (clickTimer.current !== null) window.clearTimeout(clickTimer.current); void toggleFullscreen(); }}
      />
      {fullscreen && <p className={cn("pointer-events-none absolute top-5 right-6 left-6 truncate text-sm text-white/80 transition-opacity", !visible && "opacity-0")}>{name}</p>}
      {state.waiting && !state.error && <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/10" role="status" aria-label="Buffering video"><Loader2 className="size-10 animate-spin text-white" /></div>}
      {!state.playing && !state.waiting && !state.error && (
        <PlayerButton label={state.ended ? "Replay video" : "Play video"} className="absolute size-16 rounded-full border border-white/20 bg-black/40 shadow-xl [&_svg]:size-7" onClick={() => { revealControls(); void store.togglePlayback(); }}>
          {state.ended ? <RotateCcw /> : <Play className="ml-1 fill-white" />}
        </PlayerButton>
      )}
      {state.error && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/90 px-8">
          <div className="max-w-md space-y-4 text-center text-zinc-400" role="alert">
            <Film className="mx-auto size-10 text-zinc-500" />
            <p className="text-sm text-zinc-200">{state.error}</p>
            <p className="text-xs leading-relaxed">You can retry or download the original to open it in another player.</p>
            <div className="flex justify-center gap-2">
              <Button variant="outline" size="sm" className="border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white" onClick={() => store.retry()}>Try again</Button>
              <Button variant="outline" size="sm" className="border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white" asChild><a href={url} download={name}>Download original</a></Button>
            </div>
          </div>
        </div>
      )}
      {(notice || state.notice) && !state.error && <p role="status" className="pointer-events-none absolute right-4 bottom-32 left-4 rounded-lg bg-black/70 px-3 py-2 text-center text-xs text-white">{notice || state.notice}</p>}
      <div data-player-controls="" aria-hidden={!visible} inert={!visible}
        className={cn("absolute right-2 bottom-2 left-2 flex flex-col gap-2 text-white transition-opacity duration-100", !visible && "pointer-events-none opacity-0")}
      >
        <PlayerControlGroup>
          <PlayerSlider label="Seek video" valueText={`${formatPlayerTime(currentTime)} of ${formatPlayerTime(state.duration)}`}
            value={[currentTime]} max={state.duration || 1} disabled={!state.duration || !!state.error}
            buffered={state.buffered} onValueChange={previewSeek} onValueCommit={(values) => finishSeek(values)}
            onKeyDown={(event) => { if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"].includes(event.key)) keyboardSeek.current = true; }}
            onKeyUp={() => { keyboardSeek.current = false; }}
            onPointerDown={() => { keyboardSeek.current = false; }}
            onPointerCancel={() => finishSeek([currentTime], true)} />
          <span className="shrink-0 whitespace-nowrap text-[11px] tabular-nums sm:text-xs">{formatPlayerTime(currentTime)} / {formatPlayerTime(state.duration)}</span>
        </PlayerControlGroup>
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <PlayerButton label={state.playing ? "Pause" : state.ended ? "Replay" : "Play"} className="w-12" disabled={!!state.error} onClick={() => { revealControls(); void store.togglePlayback(); }}>
              {state.playing ? <Pause className="fill-white" /> : state.ended ? <RotateCcw /> : <Play className="fill-white" />}
            </PlayerButton>
            <PlayerControlGroup className="gap-1 pl-0">
              <PlayerButton label={silent ? "Unmute" : "Mute"} aria-pressed={silent} className="bg-transparent backdrop-blur-none" onClick={() => store.toggleMute()}>
                {silent ? <VolumeX /> : state.volume < 0.5 ? <Volume1 /> : <Volume2 />}
              </PlayerButton>
              <PlayerSlider label="Volume" valueText={`${Math.round((silent ? 0 : state.volume) * 100)}%`} className="w-16" value={[silent ? 0 : state.volume]} max={1} step={0.01} onValueChange={(values) => store.setVolume(values[0])} />
            </PlayerControlGroup>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <PlayerSettings videoSpeed={state.rate} onSpeedChange={(rate) => store.setRate(rate)} open={settingsOpen} onOpenChange={setSettingsOpen} container={root} />
            {canPip && <PlayerButton label={pip ? "Exit picture-in-picture" : "Picture-in-picture"} className="hidden sm:inline-flex" disabled={!state.duration || !!state.error} onClick={() => void togglePip()}><PictureInPicture2 /></PlayerButton>}
            <PlayerButton label={fullscreen ? "Exit fullscreen" : "Fullscreen"} disabled={!canFullscreen} onClick={() => void toggleFullscreen()}>{fullscreen ? <Shrink /> : <Expand />}</PlayerButton>
          </div>
        </div>
      </div>
    </div>
  );
}
