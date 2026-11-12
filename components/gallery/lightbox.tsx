"use client";

import { useEffect, useCallback, useState, useRef } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Button } from "@/components/ui/button";
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCw, Download, Info, Loader2, ImageOff } from "lucide-react";
import { MediaInfoPanel } from "./media-info-panel";
import type { MediaFile } from "@/lib/services/file-service";
import { cn } from "@/lib/utils";
import { getImageUrl, getMediaUrl } from "@/lib/image-url";
import { VideoPlayer } from "./video-player";

interface LightboxProps {
  media: MediaFile[];
  currentIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}

export function Lightbox(props: LightboxProps) {
  if (!props.isOpen || !props.media[props.currentIndex]) return null;
  // Unmounting the viewer resets transforms and the info panel on each opening.
  return <MediaViewer {...props} />;
}

function MediaViewer({ media, currentIndex, onClose, onIndexChange }: LightboxProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [loadedPath, setLoadedPath] = useState<string | null>(null);
  const [failedPath, setFailedPath] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef({ x: 0, y: 0 });
  const lastWheelNavigation = useRef(0);
  const currentMedia = media[currentIndex];
  const isVideo = currentMedia.mediaType === "video";
  const imageUrl = getMediaUrl(currentMedia.relativePath, currentMedia.version, currentMedia.mediaType, "original");
  const previewUrl = getMediaUrl(currentMedia.relativePath, currentMedia.version, currentMedia.mediaType, "thumbnail", 192);
  const retinaPreviewUrl = getMediaUrl(currentMedia.relativePath, currentMedia.version, currentMedia.mediaType, "thumbnail", 384);

  useEffect(() => {
    // Keep the current image ahead of speculative work and limit large-file prefetches.
    if (isVideo || loadedPath !== imageUrl) return;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (connection?.saveData) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      let budget = 24 * 1024 * 1024;
      for (const index of [currentIndex + 1, currentIndex - 1]) {
        const neighbor = media[index];
        if (!neighbor || neighbor.mediaType !== "image" || neighbor.size > 16 * 1024 * 1024 || neighbor.size > budget) continue;
        budget -= neighbor.size;
        void fetch(getImageUrl(neighbor.relativePath, neighbor.version, "original"), {
          signal: controller.signal, cache: "force-cache", priority: "low",
        }).then((response) => response.ok ? response.arrayBuffer() : undefined).catch(() => {});
      }
    }, 100);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [media, currentIndex, loadedPath, imageUrl, isVideo]);

  const resetView = useCallback(() => {
    setZoom(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
    setIsDragging(false);
  }, []);

  const goToPrevious = useCallback(() => {
    if (currentIndex > 0) { resetView(); onIndexChange(currentIndex - 1); }
  }, [currentIndex, onIndexChange, resetView]);

  const goToNext = useCallback(() => {
    if (currentIndex < media.length - 1) { resetView(); onIndexChange(currentIndex + 1); }
  }, [currentIndex, media.length, onIndexChange, resetView]);

  const zoomIn = useCallback(() => setZoom((value) => Math.min(value * 1.5, 5)), []);
  const zoomOut = useCallback(() => {
    setZoom((value) => Math.max(1, value / 1.5));
    setPosition({ x: 0, y: 0 });
  }, []);
  const rotate = useCallback(() => setRotation((value) => (value + 90) % 360), []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || (event.target instanceof HTMLElement && event.target.matches("input, textarea, select, [contenteditable=true]"))) return;
      if (event.target instanceof HTMLElement) {
        if (event.target.closest("[data-player-menu]")) return;
        if (event.target.closest("[data-video-player]") && !["a", "d", "i"].includes(event.key.toLowerCase())) return;
        if (event.target.closest("[data-player-fullscreen=true]")) return;
      }
      switch (event.key.toLowerCase()) {
        case "a": case "arrowleft": event.preventDefault(); goToPrevious(); break;
        case "d": case "arrowright": event.preventDefault(); goToNext(); break;
        case "+": case "=": if (!isVideo) { event.preventDefault(); zoomIn(); } break;
        case "-": if (!isVideo) { event.preventDefault(); zoomOut(); } break;
        case "0": if (!isVideo) { event.preventDefault(); resetView(); } break;
        case "r": if (!isVideo) rotate(); break;
        case "i": setInfoOpen((value) => !value); break;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goToPrevious, goToNext, zoomIn, zoomOut, rotate, resetView, isVideo]);

  useEffect(() => {
    if (isVideo) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.deltaY) return;
      event.preventDefault();
      if (event.target instanceof HTMLImageElement) {
        if (event.deltaY < 0) zoomIn(); else zoomOut();
      } else if (performance.now() - lastWheelNavigation.current > 180) {
        lastWheelNavigation.current = performance.now();
        if (event.deltaY > 0) goToNext(); else goToPrevious();
      }
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [goToPrevious, goToNext, zoomIn, zoomOut, isVideo]);

  const iconButton = "shrink-0 text-zinc-300 hover:bg-white/10 hover:text-white disabled:opacity-25";
  const failed = failedPath === imageUrl;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className="flex! h-dvh! max-h-none! w-screen! max-w-none! flex-col gap-0! overflow-hidden rounded-none! border-0 bg-zinc-950 p-0! text-white shadow-none"
        showCloseButton={false}
        onEscapeKeyDown={(event) => {
          if (document.querySelector("[data-player-settings-open=true]")) {
            event.preventDefault();
          } else if (document.fullscreenElement?.matches("[data-video-player]")) {
            event.preventDefault();
            void document.exitFullscreen().catch(() => {});
          } else if (infoOpen) { event.preventDefault(); setInfoOpen(false); }
        }}
      >
        <VisuallyHidden>
          <DialogTitle>{currentMedia.name}</DialogTitle>
          <DialogDescription>{isVideo ? "Use the video controls to play, seek, and adjust volume. Use the navigation buttons to browse your media." : "Use arrow keys to browse, plus and minus to zoom, and I for file information."}</DialogDescription>
        </VisuallyHidden>
        <div className="z-10 flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-zinc-950 px-3 py-2.5 sm:gap-4 sm:px-5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium" title={currentMedia.name}>{currentMedia.name}</p>
            <p className="mt-0.5 text-xs text-zinc-500 tabular-nums">{(currentIndex + 1).toLocaleString()} / {media.length.toLocaleString()}</p>
          </div>
          <div className="flex items-center gap-0.5 sm:gap-1">
            {!isVideo && <div className="hidden items-center sm:flex">
              <Button variant="ghost" size="icon" className={iconButton} onClick={zoomOut} disabled={zoom <= 1} title="Zoom out (-)" aria-label="Zoom out"><ZoomOut className="size-4" /></Button>
              <Button variant="ghost" className={cn(iconButton, "min-w-16 px-2 text-xs tabular-nums")} onClick={resetView} title="Reset view (0)" aria-label="Reset view">{Math.round(zoom * 100)}%</Button>
              <Button variant="ghost" size="icon" className={iconButton} onClick={zoomIn} disabled={zoom >= 5} title="Zoom in (+)" aria-label="Zoom in"><ZoomIn className="size-4" /></Button>
              <span className="mx-2 h-4 w-px bg-white/10" />
            </div>}
            {!isVideo && <Button variant="ghost" size="icon" className={iconButton} onClick={rotate} title="Rotate (R)" aria-label="Rotate image"><RotateCw className="size-4" /></Button>}
            <Button variant="ghost" size="icon" className={cn(iconButton, infoOpen && "bg-white/10 text-white")} onClick={() => setInfoOpen((value) => !value)} title="File information (I)" aria-label="File information" aria-expanded={infoOpen} aria-controls="media-info-panel"><Info className="size-4" /></Button>
            <Button variant="ghost" size="icon" className={iconButton} asChild>
              <a href={imageUrl} download={currentMedia.name} title="Download original" aria-label="Download original"><Download className="size-4" /></a>
            </Button>
            <span className="mx-1 h-4 w-px bg-white/10 sm:mx-2" />
            <Button variant="ghost" size="icon" className={iconButton} onClick={onClose} title="Close (Esc)" aria-label="Close viewer"><X className="size-5" /></Button>
          </div>
        </div>
        <div className="relative flex min-h-0 flex-1">
          <div
            ref={canvasRef}
            className="relative flex min-w-0 flex-1 items-center justify-center overflow-hidden p-4 sm:p-12"
            onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
            onPointerDown={(event) => {
              if (zoom <= 1 || event.button !== 0 || !(event.target instanceof HTMLImageElement)) return;
              event.preventDefault();
              event.target.setPointerCapture(event.pointerId);
              dragStart.current = { x: event.clientX - position.x, y: event.clientY - position.y };
              setIsDragging(true);
            }}
            onPointerMove={(event) => { if (isDragging) setPosition({ x: event.clientX - dragStart.current.x, y: event.clientY - dragStart.current.y }); }}
            onPointerUp={() => setIsDragging(false)}
            onPointerCancel={() => setIsDragging(false)}
          >
            {isVideo ? <VideoPlayer key={imageUrl} src={imageUrl} poster={retinaPreviewUrl} name={currentMedia.name} /> : failed ? (
              <div className="max-w-sm space-y-3 px-8 text-center text-zinc-400" role="alert">
                <ImageOff className="mx-auto size-9 text-zinc-600" />
                <p className="text-sm">This image could not be displayed.</p>
                <p className="text-xs leading-relaxed text-zinc-500">You can still check its file information or download the original.</p>
              </div>
            ) : (
              <>
                {loadedPath !== imageUrl && (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={previewUrl} srcSet={`${previewUrl} 1x, ${retinaPreviewUrl} 2x`} alt="" aria-hidden="true" className="pointer-events-none absolute max-h-[85%] max-w-[85%] object-contain opacity-60 blur-sm" />
                    <Loader2 className="pointer-events-none absolute z-10 size-6 animate-spin text-zinc-300" aria-label="Loading image" />
                  </>
                )}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  key={imageUrl} src={imageUrl} alt={currentMedia.name}
                  decoding="async" fetchPriority="high"
                  className={cn("relative max-h-full max-w-full select-none object-contain", loadedPath !== imageUrl && "opacity-0", zoom > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in")}
                  style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${zoom}) rotate(${rotation}deg)`, transition: isDragging ? "none" : "transform 150ms ease-out", touchAction: zoom > 1 ? "none" : "auto" }}
                  draggable={false}
                  onLoad={(event) => {
                    const element = event.currentTarget;
                    void element.decode().catch(() => {}).then(() => {
                      if (element.isConnected) setLoadedPath(imageUrl);
                    });
                  }}
                  onError={() => setFailedPath(imageUrl)}
                  onDoubleClick={() => { if (zoom > 1) resetView(); else zoomIn(); }}
                />
              </>
            )}
            <Button variant="ghost" size="icon" className={cn(iconButton, "absolute left-2 top-1/2 size-10 -translate-y-1/2 rounded-full border border-white/10 bg-zinc-950/60 sm:left-4")} onClick={goToPrevious} disabled={currentIndex === 0} title="Previous file (←)" aria-label="Previous file"><ChevronLeft className="size-5" /></Button>
            <Button variant="ghost" size="icon" className={cn(iconButton, "absolute right-2 top-1/2 size-10 -translate-y-1/2 rounded-full border border-white/10 bg-zinc-950/60 sm:right-4")} onClick={goToNext} disabled={currentIndex === media.length - 1} title="Next file (→)" aria-label="Next file"><ChevronRight className="size-5" /></Button>
          </div>
          {infoOpen && <MediaInfoPanel key={currentMedia.version} relativePath={currentMedia.relativePath} mediaType={currentMedia.mediaType} onClose={() => setInfoOpen(false)} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
