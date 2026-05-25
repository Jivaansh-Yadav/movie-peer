import { useEffect, useRef } from "react";

interface Props {
  tmdbId: number;
  mediaType: "movie" | "tv";
  season?: number;
  episode?: number;
  isHost: boolean;
  onPlay?: (time: number) => void;
  onPause?: (time: number) => void;
  onSeek?: (time: number) => void;
  remotePlaybackState?: "playing" | "paused";
  remoteTime?: number;
  remoteUpdatedAt?: number; // ms epoch
}

// VidKing iframe player. Docs: https://www.vidking.net/#documentation
// URL pattern: https://www.vidking.net/embed/movie/{tmdb_id}
//              https://www.vidking.net/embed/tv/{tmdb_id}/{season}/{episode}
// Emits postMessage events { type: 'PLAYER_EVENT', data: { event, currentTime, duration } }
export function VidKingPlayer({
  tmdbId,
  mediaType,
  season,
  episode,
  isHost,
  onPlay,
  onPause,
  onSeek,
  remotePlaybackState,
  remoteTime,
  remoteUpdatedAt,
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const lastAppliedRef = useRef<number>(0);

  const base =
    mediaType === "tv"
      ? `https://www.vidking.net/embed/tv/${tmdbId}/${season ?? 1}/${episode ?? 1}`
      : `https://www.vidking.net/embed/movie/${tmdbId}`;

  const src = `${base}?color=a855f7&autoPlay=false&primaryColor=a855f7&secondaryColor=ffffff`;

  // Listen for player events (host broadcasts to others)
  useEffect(() => {
    function onMsg(ev: MessageEvent) {
      const d = ev.data;
      if (!d || d.type !== "PLAYER_EVENT") return;
      if (!isHost) return;
      const data = d.data ?? {};
      switch (data.event) {
        case "play":
          onPlay?.(data.currentTime ?? 0);
          break;
        case "pause":
          onPause?.(data.currentTime ?? 0);
          break;
        case "seeked":
          onSeek?.(data.currentTime ?? 0);
          break;
        case "timeupdate":
          // Throttle: broadcast every ~5s
          if (
            data.currentTime &&
            Math.abs((data.currentTime as number) - lastAppliedRef.current) > 5
          ) {
            lastAppliedRef.current = data.currentTime;
            onSeek?.(data.currentTime);
          }
          break;
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [isHost, onPlay, onPause, onSeek]);

  // Apply remote state for non-hosts
  useEffect(() => {
    if (isHost || !iframeRef.current?.contentWindow || remoteTime == null) return;
    const drift = (Date.now() - (remoteUpdatedAt ?? Date.now())) / 1000;
    const target = (remoteTime ?? 0) + (remotePlaybackState === "playing" ? drift : 0);
    iframeRef.current.contentWindow.postMessage(
      { type: "PLAYER_COMMAND", command: "seek", value: target },
      "*",
    );
    iframeRef.current.contentWindow.postMessage(
      {
        type: "PLAYER_COMMAND",
        command: remotePlaybackState === "playing" ? "play" : "pause",
      },
      "*",
    );
  }, [isHost, remoteTime, remotePlaybackState, remoteUpdatedAt]);

  return (
    <div className="relative w-full overflow-hidden rounded-2xl glass-strong shadow-cinema aspect-video">
      <iframe
        ref={iframeRef}
        src={src}
        allow="autoplay; fullscreen; encrypted-media"
        allowFullScreen
        className="absolute inset-0 h-full w-full"
        title="VidKing player"
      />
    </div>
  );
}
