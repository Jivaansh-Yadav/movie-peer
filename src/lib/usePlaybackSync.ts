import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type PlaybackState = "playing" | "paused";

export interface RemoteState {
  currentTime: number;
  paused: boolean;
  updatedAt: number; // ms epoch
  hostUserId: string;
}

export type SyncStatus = "synced" | "resyncing" | "host";

interface Options {
  sessionId: string;
  roomCode: string;
  userId: string;
  isHost: boolean;
  hostUserId: string;
  /** Initial DB-persisted state for late joiners */
  initial: { currentTime: number; paused: boolean; updatedAt: number } | null;
  /** Persist authoritative state to DB (host only). */
  persist: (state: { currentTime: number; paused: boolean }) => void;
}

const DRIFT_HARD_RESYNC = 2; // seconds
const HOST_TICK_INTERVAL_MS = 2500;

/**
 * Host-authoritative playback sync over Supabase Realtime broadcast.
 * - Host emits play/pause/seek instantly + a throttled tick.
 * - Members track latest authoritative state and the local iframe time;
 *   compute drift and trigger a hard resync (iframe reload) when >2s.
 */
export function usePlaybackSync({
  sessionId,
  roomCode,
  userId,
  isHost,
  hostUserId,
  initial,
  persist,
}: Options) {
  const [remote, setRemote] = useState<RemoteState | null>(() =>
    initial
      ? {
          currentTime: initial.currentTime,
          paused: initial.paused,
          updatedAt: initial.updatedAt,
          hostUserId,
        }
      : null,
  );

  // Initial progress used for iframe src on mount / hard resync.
  // Account for network delay since the host broadcast.
  const computeInitialProgress = useCallback(
    (state: RemoteState | null): number => {
      if (!state) return 0;
      const elapsed = (Date.now() - state.updatedAt) / 1000;
      const drift = state.paused ? 0 : Math.max(0, elapsed);
      return Math.max(0, state.currentTime + drift);
    },
    [],
  );

  const [initialProgress, setInitialProgress] = useState<number>(() =>
    computeInitialProgress(
      initial
        ? { ...initial, hostUserId }
        : null,
    ),
  );
  // resyncToken changes ⇒ iframe re-mounts with fresh progress param
  const [resyncToken, setResyncToken] = useState(0);
  const [status, setStatus] = useState<SyncStatus>(isHost ? "host" : "resyncing");

  // Member's local iframe time (from postMessage timeupdate)
  const localTimeRef = useRef<number>(initial?.currentTime ?? 0);
  // Last broadcast tick from host (throttle)
  const lastHostTickRef = useRef<number>(0);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Subscribe to broadcast channel
  useEffect(() => {
    const ch = supabase.channel(`playback:${roomCode}`, {
      config: { broadcast: { self: false, ack: false } },
    });
    channelRef.current = ch;

    ch.on("broadcast", { event: "playback" }, (msg) => {
      const p = msg.payload as RemoteState & { kind: string };
      if (!p) return;
      setRemote({
        currentTime: p.currentTime,
        paused: p.paused,
        updatedAt: p.updatedAt,
        hostUserId: p.hostUserId,
      });
      if (isHost) return;

      // Hard events: play / pause / seek → force resync
      if (p.kind === "seek" || p.kind === "play" || p.kind === "pause") {
        setInitialProgress(computeInitialProgress(p));
        setResyncToken((n) => n + 1);
        setStatus("resyncing");
        return;
      }

      // tick → drift check against local iframe time
      const expected =
        p.currentTime + (p.paused ? 0 : (Date.now() - p.updatedAt) / 1000);
      const drift = Math.abs(expected - localTimeRef.current);
      if (drift > DRIFT_HARD_RESYNC) {
        setInitialProgress(expected);
        setResyncToken((n) => n + 1);
        setStatus("resyncing");
      } else {
        setStatus("synced");
      }
    });

    ch.subscribe();

    return () => {
      supabase.removeChannel(ch);
      channelRef.current = null;
    };
  }, [roomCode, isHost, computeInitialProgress]);

  // ---- Host broadcast helpers ----
  const broadcast = useCallback(
    (
      kind: "play" | "pause" | "seek" | "tick",
      currentTime: number,
      paused: boolean,
    ) => {
      const payload: RemoteState & { kind: string } = {
        kind,
        currentTime,
        paused,
        updatedAt: Date.now(),
        hostUserId: userId,
      };
      channelRef.current?.send({
        type: "broadcast",
        event: "playback",
        payload,
      });
      if (kind !== "tick") {
        persist({ currentTime, paused });
      }
    },
    [userId, persist],
  );

  const onHostPlay = useCallback(
    (t: number) => isHost && broadcast("play", t, false),
    [isHost, broadcast],
  );
  const onHostPause = useCallback(
    (t: number) => isHost && broadcast("pause", t, true),
    [isHost, broadcast],
  );
  const onHostSeek = useCallback(
    (t: number, paused: boolean) =>
      isHost && broadcast("seek", t, paused),
    [isHost, broadcast],
  );
  const onHostTime = useCallback(
    (t: number, paused: boolean) => {
      localTimeRef.current = t;
      if (!isHost) return;
      const now = Date.now();
      if (now - lastHostTickRef.current < HOST_TICK_INTERVAL_MS) return;
      lastHostTickRef.current = now;
      broadcast("tick", t, paused);
    },
    [isHost, broadcast],
  );

  // Member: register own iframe time
  const onLocalTime = useCallback((t: number) => {
    localTimeRef.current = t;
  }, []);

  // Manual resync from member
  const forceResync = useCallback(() => {
    if (isHost || !remote) return;
    setInitialProgress(computeInitialProgress(remote));
    setResyncToken((n) => n + 1);
    setStatus("resyncing");
  }, [isHost, remote, computeInitialProgress]);

  // When iframe finishes loading, member transitions resyncing→synced shortly after
  const markSynced = useCallback(() => {
    if (!isHost) setStatus("synced");
  }, [isHost]);

  return useMemo(
    () => ({
      status,
      remote,
      initialProgress,
      resyncToken,
      onHostPlay,
      onHostPause,
      onHostSeek,
      onHostTime,
      onLocalTime,
      forceResync,
      markSynced,
    }),
    [
      status,
      remote,
      initialProgress,
      resyncToken,
      onHostPlay,
      onHostPause,
      onHostSeek,
      onHostTime,
      onLocalTime,
      forceResync,
      markSynced,
    ],
  );
}
