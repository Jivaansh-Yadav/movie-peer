import { useEffect, useMemo, useRef } from "react";

interface Props {
  tmdbId: number;
  mediaType: "movie" | "tv";
  season?: number;
  episode?: number;
  isHost: boolean;
  /** Seconds. Used in `?progress=` on mount and whenever `resyncToken` changes. */
  initialProgress: number;
  /** Bump to force iframe reload at the latest initialProgress. */
  resyncToken: number;
  onPlay?: (time: number) => void;
  onPause?: (time: number) => void;
  onSeek?: (time: number, paused: boolean) => void;
  onTime?: (time: number, paused: boolean) => void;
  onLoaded?: () => void;
}

// VidKing iframe — host emits events upward; members receive `progress` on
// (re)mounts only, never on every state change. Hard resyncs re-key the iframe.
export function VidKingPlayer({
  tmdbId,
  mediaType,
  season,
  episode,
  isHost,
  initialProgress,
  resyncToken,
  onPlay,
  onPause,
  onSeek,
  onTime,
  onLoaded,
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const pausedRef = useRef<boolean>(true);

  const src = useMemo(() => {
    const base =
      mediaType === "tv"
        ? `https://www.vidking.net/embed/tv/${tmdbId}/${season ?? 1}/${episode ?? 1}`
        : `https://www.vidking.net/embed/movie/${tmdbId}`;
    const params = new URLSearchParams({
      color: "5865f2",
      primaryColor: "5865f2",
      secondaryColor: "ffffff",
      autoPlay: "true",
      nextEpisode: "true",
      episodeSelector: "true",
      progress: String(Math.max(0, Math.floor(initialProgress))),
    });
    return `${base}?${params.toString()}`;
    // resyncToken intentionally invalidates the memo to remount the iframe
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tmdbId, mediaType, season, episode, resyncToken]);

  // Player event listener
  useEffect(() => {
    function onMsg(ev: MessageEvent) {
      const d = ev.data;
      if (!d || d.type !== "PLAYER_EVENT") return;
      const data = d.data ?? {};
      const t = Number(data.currentTime ?? 0);
      switch (data.event) {
        case "play":
          pausedRef.current = false;
          onPlay?.(t);
          break;
        case "pause":
          pausedRef.current = true;
          onPause?.(t);
          break;
        case "seeked":
          onSeek?.(t, pausedRef.current);
          break;
        case "timeupdate":
          onTime?.(t, pausedRef.current);
          break;
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [onPlay, onPause, onSeek, onTime]);

  return (
    <div className="relative w-full overflow-hidden rounded-2xl glass-strong shadow-cinema aspect-video">
      <iframe
        key={resyncToken}
        ref={iframeRef}
        src={src}
        onLoad={onLoaded}
        allow="autoplay; fullscreen; encrypted-media"
        allowFullScreen
        className="absolute inset-0 h-full w-full"
        title="VidKing player"
      />
      {!isHost && (
        <div className="pointer-events-none absolute top-3 left-3 glass rounded-full px-2.5 py-1 text-[10px] uppercase tracking-widest text-muted-foreground">
          Host controls playback
        </div>
      )}
    </div>
  );
}
