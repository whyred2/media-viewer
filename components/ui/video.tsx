"use client";

import * as React from "react";
import * as Slider from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";

export function PlayerControlGroup({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex h-8 min-h-8 items-center gap-2 rounded-sm bg-white/20 px-2 backdrop-blur-md", className)} {...props} />;
}

export function PlayerButton({ className, label, ...props }: React.ComponentProps<"button"> & { label: string }) {
  return (
    <button type="button" aria-label={label} title={label}
      className={cn("inline-flex size-8 shrink-0 items-center justify-center rounded-sm bg-white/20 text-white backdrop-blur-md transition-colors hover:bg-white/40 active:bg-white/30 disabled:cursor-not-allowed disabled:opacity-35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white [&_svg]:size-5", className)}
      {...props} />
  );
}

interface PlayerSliderProps extends React.ComponentProps<typeof Slider.Root> {
  label: string;
  valueText?: string;
  buffered?: readonly { start: number; end: number }[];
}

export function PlayerSlider({ className, label, valueText, buffered = [], max = 100, ...props }: PlayerSliderProps) {
  return (
    <Slider.Root data-player-slider="" className={cn("relative flex h-4 w-full touch-none select-none items-center rounded before:absolute before:inset-x-0 before:-inset-y-2 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-white/80 data-[disabled]:opacity-40", className)} max={max} step={0.1} {...props}>
      <Slider.Track className="relative h-full grow overflow-hidden rounded bg-black/60">
        {max > 0 && buffered.map((range, index) => (
          <span key={index} className="absolute inset-y-0 bg-white/25" style={{ left: `${range.start / max * 100}%`, width: `${(range.end - range.start) / max * 100}%` }} />
        ))}
        <Slider.Range className="absolute h-full bg-white/80" />
      </Slider.Track>
      <Slider.Thumb aria-label={label} aria-valuetext={valueText}
        className="block h-4 w-px bg-transparent opacity-0 outline-none" />
    </Slider.Root>
  );
}
