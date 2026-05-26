import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getRoom } from "@/lib/session.functions";
import { useUser } from "@/lib/user-store";
import { VidKingPlayer } from "@/components/VidKingPlayer";
import { ChatPanel } from "@/components/ChatPanel";
import { PresenceBar } from "@/components/PresenceBar";
import { usePlaybackSync } from "@/lib/usePlaybackSync";

export const Route = createFileRoute("/session/$roomId")({
  head: ({ params }) => ({
    meta: [
      { title: `Room ${params.roomId} — MoviePeer` },
      { name: "description", content: "Join this MoviePeer watch party." },
    ],
  }),
  component: SessionPage,
});

interface SessionRow {
  id: string;
  room_code: string;
  host_id: string;
  tmdb_id: number;
  media_type: "movie" | "tv";
  title: string | null;
  backdrop_path: string | null;
  season: number | null;
  episode: number | null;
  playback_time: number | null;
  playback_state: "playing" | "paused" | null;
  updated_at: string;
}

function SessionPage() {
  const { roomId } = Route.useParams();
  const getRoomFn = useServerFn(getRoom);
  const { userId, username, setUsername } = useUser();

  const code = roomId.toUpperCase();
  const initial = useQuery({
    queryKey: ["session", code],
    queryFn: () => getRoomFn({ data: { roomCode: code } }),
  });

  const [session, setSession] = useState<SessionRow | null>(null);
  useEffect(() => {
    if (initial.data) setSession(initial.data as SessionRow);
  }, [initial.data]);

  // Subscribe to session row updates (host changes, metadata)
  useEffect(() => {
    if (!session) return;
    const sub = supabase
      .channel(`session-row:${session.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "sessions", filter: `id=eq.${session.id}` },
        (payload) => setSession((s) => (s ? { ...s, ...(payload.new as SessionRow) } : s)),
      )
      .subscribe();
    return () => void supabase.removeChannel(sub);
  }, [session?.id]);

  // Presence + typing channel
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const [presences, setPresences] = useState<{ user_id: string; username: string }[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  useEffect(() => {
    if (!session) return;
    const ch = supabase.channel(`movie-room:${code}`, {
      config: { presence: { key: userId } },
    });
    channelRef.current = ch;

    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState() as Record<
        string,
        { user_id: string; username: string; typing?: boolean }[]
      >;
      const flat = Object.values(state).flat();
      const seen = new Map<string, { user_id: string; username: string }>();
      const typing: string[] = [];
      for (const p of flat) {
        if (!seen.has(p.user_id)) seen.set(p.user_id, { user_id: p.user_id, username: p.username });
        if (p.typing && p.user_id !== userId) typing.push(p.username);
      }
      setPresences(Array.from(seen.values()));
      setTypingUsers([...new Set(typing)]);
    });

    ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await ch.track({ user_id: userId, username, typing: false });
      }
    });

    return () => {
      supabase.removeChannel(ch);
      channelRef.current = null;
    };
  }, [session?.id, code, userId, username]);

  const isHost = session?.host_id === userId;

  // Persist authoritative playback state (host-only writes)
  const persistTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const persist = useCallback(
    (s: { currentTime: number; paused: boolean }) => {
      if (!session) return;
      clearTimeout(persistTimer.current);
      persistTimer.current = setTimeout(() => {
        void supabase
          .from("sessions")
          .update({
            playback_state: s.paused ? "paused" : "playing",
            playback_time: s.currentTime,
            updated_at: new Date().toISOString(),
          })
          .eq("id", session.id);
      }, 400);
    },
    [session?.id],
  );

  const initialPlayback = session
    ? {
        currentTime: session.playback_time ?? 0,
        paused: (session.playback_state ?? "paused") !== "playing",
        updatedAt: session.updated_at ? new Date(session.updated_at).getTime() : Date.now(),
      }
    : null;

  const sync = usePlaybackSync({
    sessionId: session?.id ?? "",
    roomCode: code,
    userId,
    isHost,
    hostUserId: session?.host_id ?? "",
    initial: initialPlayback,
    persist,
  });

  async function transferHost(newHostId: string) {
    if (!session || !isHost) return;
    await supabase.from("sessions").update({ host_id: newHostId }).eq("id", session.id);
    await supabase.from("messages").insert({
      session_id: session.id,
      message: `Host transferred`,
      kind: "system",
    });
  }

  if (initial.isLoading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen grid place-items-center p-6 text-center">
        <div className="glass-strong rounded-3xl p-10 max-w-md">
          <h1 style={{ fontFamily: "var(--font-display)" }} className="text-4xl mb-3">
            Room not found
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            The room <span className="text-marquee font-semibold">{code}</span> doesn't exist or has
            ended. Pick a movie to start a new party.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-primary-foreground text-sm font-medium hover:shadow-glow transition"
          >
            <ArrowLeft className="h-4 w-4" /> Back home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 sm:p-6">
      <div className="mx-auto max-w-[1500px] grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Link
              to="/"
              className="glass rounded-full px-3 py-1.5 text-xs inline-flex items-center gap-1.5 hover:bg-white/10 transition"
            >
              <ArrowLeft className="h-3 w-3" /> Leave
            </Link>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Now watching</div>
              <div className="text-sm font-medium truncate max-w-[60vw]">{session.title}</div>
            </div>
          </div>

          <VidKingPlayer
            tmdbId={session.tmdb_id}
            mediaType={session.media_type}
            season={session.season ?? undefined}
            episode={session.episode ?? undefined}
            isHost={isHost}
            initialProgress={sync.initialProgress}
            resyncToken={sync.resyncToken}
            onPlay={sync.onHostPlay}
            onPause={sync.onHostPause}
            onSeek={sync.onHostSeek}
            onTime={isHost ? sync.onHostTime : (t) => sync.onLocalTime(t)}
            onLoaded={sync.markSynced}
          />

          <PresenceBar
            roomCode={session.room_code}
            hostId={session.host_id}
            presences={presences}
            onTransferHost={transferHost}
            onRename={(n) => {
              setUsername(n);
              channelRef.current?.track({ user_id: userId, username: n, typing: false });
            }}
          />
        </div>

        <div className="h-[calc(100vh-2rem)] lg:h-[calc(100vh-3rem)] min-h-[420px]">
          <ChatPanel
            sessionId={session.id}
            channel={channelRef.current}
            typingUsers={typingUsers}
            isHost={isHost}
            syncStatus={sync.status}
            onResync={sync.forceResync}
          />
        </div>
      </div>
    </div>
  );
}
