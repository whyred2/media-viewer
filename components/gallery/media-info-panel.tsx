"use client";

import { useEffect, useState } from "react";
import { FileImage, Film, Info, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ImageInfo, MediaType, VideoInfo } from "@/lib/types";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes.toLocaleString()} B`;
  const units = ["KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)) - 1, units.length - 1);
  return `${(bytes / 1024 ** (index + 1)).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${units[index]}`;
}

function formatDuration(seconds: number): string {
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainder = String(total % 60).padStart(2, "0");
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${remainder}` : `${minutes}:${remainder}`;
}

export function MediaInfoPanel({ relativePath, mediaType, onClose }: { relativePath: string; mediaType: MediaType; onClose: () => void }) {
  const [info, setInfo] = useState<ImageInfo | VideoInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const videoInfo = info && "duration" in info ? info : null;

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(`/api/${mediaType === "video" ? "video" : "image"}?${new URLSearchParams({ path: relativePath, size: "info" })}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Could not read file information.");
        const data: ImageInfo | VideoInfo = await response.json();
        if (!controller.signal.aborted) setInfo(data);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not read file information.");
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [relativePath, mediaType, attempt]);

  return (
    <aside
      id="media-info-panel" aria-label="File information"
      className="absolute inset-y-0 right-0 z-20 w-full max-w-sm overflow-y-auto border-l border-white/10 bg-zinc-950/98 p-5 text-zinc-100 shadow-2xl md:relative md:w-80 md:shrink-0 md:shadow-none"
    >
      <div className="mb-8 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-medium"><Info className="size-4 text-zinc-400" />File information</h2>
        <Button variant="ghost" size="icon" className="size-8 text-zinc-400 hover:bg-white/10 hover:text-white" onClick={onClose} aria-label="Close file information"><X className="size-4" /></Button>
      </div>
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-zinc-400" role="status"><Loader2 className="size-4 animate-spin" />Reading file details…</div>
      ) : error ? (
        <div role="alert" className="space-y-3 text-sm text-zinc-400">
          <p>{error}</p>
          <Button variant="outline" size="sm" className="border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white" onClick={() => { setError(null); setIsLoading(true); setAttempt((value) => value + 1); }}>Try again</Button>
        </div>
      ) : info && (
        <>
          <div className="mb-7">
            <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-white/5">{mediaType === "video" ? <Film className="size-5 text-zinc-400" /> : <FileImage className="size-5 text-zinc-400" />}</div>
            <p className="break-all text-base leading-relaxed font-medium">{info.name}</p>
            <p className="mt-1 text-xs text-zinc-500">Original file</p>
          </div>
          <dl className="space-y-5 text-sm">
            <div><dt className="mb-1.5 text-xs text-zinc-500">Location in gallery</dt><dd className="break-all leading-relaxed text-zinc-300">{info.relativePath}</dd></div>
            <div className="grid grid-cols-2 gap-4">
              <div><dt className="mb-1.5 text-xs text-zinc-500">File size</dt><dd title={`${info.size.toLocaleString()} bytes`}>{formatBytes(info.size)}</dd></div>
              <div><dt className="mb-1.5 text-xs text-zinc-500">Format</dt><dd className="uppercase">{info.format}</dd></div>
            </div>
            <div><dt className="mb-1.5 text-xs text-zinc-500">Dimensions</dt><dd>{info.width && info.height ? `${info.width.toLocaleString()} × ${info.height.toLocaleString()} px` : "Unavailable for this file"}</dd></div>
            {videoInfo && <>
              <div><dt className="mb-1.5 text-xs text-zinc-500">Duration</dt><dd>{videoInfo.duration !== null ? formatDuration(videoInfo.duration) : "Unavailable"}</dd></div>
              <div className="grid grid-cols-2 gap-4">
                <div><dt className="mb-1.5 text-xs text-zinc-500">Video codec</dt><dd className="uppercase">{videoInfo.videoCodec || "Unavailable"}</dd></div>
                <div><dt className="mb-1.5 text-xs text-zinc-500">Frame rate</dt><dd>{videoInfo.frameRate ? `${videoInfo.frameRate.toLocaleString(undefined, { maximumFractionDigits: 2 })} fps` : "Unavailable"}</dd></div>
              </div>
            </>}
            <div><dt className="mb-1.5 text-xs text-zinc-500">Last modified</dt><dd>{new Date(info.modifiedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</dd></div>
          </dl>
          <p className="mt-8 border-t border-white/10 pt-4 text-xs leading-relaxed text-zinc-500">{mediaType === "video" ? "Playback does not modify your original file." : "Zoom and rotation only change the preview. Your original file stays unchanged."}</p>
        </>
      )}
    </aside>
  );
}
