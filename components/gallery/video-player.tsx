"use client";

import { VideoPlayer as PortfolioVideoPlayer } from "@/components/player-handler";

export function VideoPlayer({ src, poster, name }: { src: string; poster: string; name: string }) {
  return <PortfolioVideoPlayer key={src} url={src} poster={poster} name={name} />;
}
