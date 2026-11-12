"use client";

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Bolt, ChevronLeft } from "lucide-react";
import { PlayerButton } from "@/components/ui/video";
import { PlayerMenu, PlayerMenuItem, PlayerMenuRadioGroup, PlayerMenuRadioItem } from "@/components/ui/player-menu";
import { PLAYER_SPEEDS } from "@/lib/video-player";
import { cn } from "@/lib/utils";

interface PlayerSettingsProps {
  videoSpeed: number;
  onSpeedChange: (speed: number) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  container?: HTMLElement | null;
}

export function PlayerSettings({ videoSpeed, onSpeedChange, open, onOpenChange, container }: PlayerSettingsProps) {
  const [speedOpen, setSpeedOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const speedTriggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const speedId = useId();
  const subscribeSize = useCallback((notify: () => void) => {
    if (!container) return () => {};
    const observer = new ResizeObserver(notify);
    observer.observe(container);
    return () => observer.disconnect();
  }, [container]);
  const wide = useSyncExternalStore(subscribeSize, useCallback(() => (container?.clientWidth ?? 0) >= 474, [container]), () => false);

  const close = useCallback((restoreFocus = false) => {
    setSpeedOpen(false);
    onOpenChange(false);
    if (restoreFocus) triggerRef.current?.focus({ preventScroll: true });
  }, [onOpenChange]);

  useEffect(() => {
    if (!open || !container) return;
    const doc = container.ownerDocument;
    const onOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !triggerRef.current?.contains(target)) close();
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (speedOpen) setSpeedOpen(false);
      else close(true);
    };
    doc.addEventListener("pointerdown", onOutside);
    doc.addEventListener("keydown", onEscape, true);
    return () => {
      doc.removeEventListener("pointerdown", onOutside);
      doc.removeEventListener("keydown", onEscape, true);
    };
  }, [open, container, speedOpen, close]);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      if (speedOpen) panelRef.current?.querySelector<HTMLInputElement>("input:checked")?.focus({ preventScroll: true });
      else speedTriggerRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open, speedOpen, wide]);

  return (
    <>
      <PlayerButton ref={triggerRef} label="Player settings" aria-expanded={open} aria-controls={panelId}
        onClick={() => { setSpeedOpen(false); onOpenChange(!open); }}>
        <Bolt className={cn("transition-transform duration-300", open && "rotate-90")} />
      </PlayerButton>
      {container && createPortal(
        <div ref={panelRef} id={panelId} data-player-menu="" data-player-settings-open={open || undefined}
          data-settings-layout={wide ? "side-by-side" : "single-panel"}
          className={cn("pointer-events-none absolute right-2 bottom-22 z-30 h-[min(400px,calc(100%_-_6.5rem))] w-[calc(100%_-_1rem)] overflow-hidden", wide ? "max-w-[458px]" : "max-w-[250px]")}
          aria-hidden={!open} inert={!open}>
          <PlayerMenu data-settings-panel="main" className={cn("max-h-full w-[250px] max-w-full transition-transform duration-300 ease-in-out motion-reduce:transition-none",
            !open ? "translate-x-[calc(100%_+_8px)]" : speedOpen ? wide ? "-translate-x-[208px]" : "-translate-x-[calc(100%_+_8px)]" : "translate-x-0",
            open && (!speedOpen || wide) && "pointer-events-auto")}
            aria-hidden={!open || (speedOpen && !wide)} inert={!open || (speedOpen && !wide)}>
            <PlayerMenuItem ref={speedTriggerRef} checked={speedOpen} aria-expanded={speedOpen} aria-controls={speedId}
              onClick={() => setSpeedOpen((value) => !value)}
              onKeyDown={(event) => { if (event.key === "ArrowRight") { event.preventDefault(); event.stopPropagation(); setSpeedOpen(true); } }}>
              <span>Speed</span><span className="tabular-nums">{videoSpeed}x</span>
            </PlayerMenuItem>
          </PlayerMenu>
          <PlayerMenu id={speedId} data-settings-panel="speed" className={cn("flex max-h-full max-w-full flex-col transition-transform duration-300 ease-in-out motion-reduce:transition-none",
            wide ? "w-[200px]" : "w-[250px]", open && speedOpen ? "pointer-events-auto translate-x-0" : "translate-x-[calc(100%_+_8px)]")}
            aria-hidden={!open || !speedOpen} inert={!open || !speedOpen}
            onKeyDown={(event) => { if (event.key === "ArrowLeft") { event.preventDefault(); event.stopPropagation(); setSpeedOpen(false); } }}>
            {!wide && <button type="button" className="flex h-10 shrink-0 items-center gap-2 border-b border-white/10 px-4 text-left text-xs hover:bg-white/20 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white/80" onClick={() => setSpeedOpen(false)} aria-label="Back to player settings"><ChevronLeft className="size-4" />Playback speed</button>}
            <PlayerMenuRadioGroup value={videoSpeed} onValueChange={onSpeedChange} aria-label="Playback speed">
              {PLAYER_SPEEDS.map((speed) => <PlayerMenuRadioItem key={speed} value={speed}>{speed}x</PlayerMenuRadioItem>)}
            </PlayerMenuRadioGroup>
          </PlayerMenu>
        </div>, container,
      )}
    </>
  );
}
