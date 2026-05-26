import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Smile, RefreshCw, Radio } from "lucide-react";
import type { SyncStatus } from "@/lib/usePlaybackSync";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/lib/user-store";

interface Msg {
  id: string;
  user_id: string | null;
  username: string | null;
  message: string;
  kind: string;
  created_at: string;
}

const REACTIONS = ["❤️", "🔥", "😂", "😮", "👏", "🍿"];

export function ChatPanel({
  sessionId,
  channel,
  typingUsers,
  isHost,
  syncStatus,
  onResync,
}: {
  sessionId: string;
  channel: ReturnType<typeof supabase.channel> | null;
  typingUsers: string[];
  isHost: boolean;
  syncStatus: SyncStatus;
  onResync: () => void;
}) {
  const { userId, username } = useUser();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Load history + subscribe
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true })
        .limit(200);
      if (!cancelled && data) setMessages(data as Msg[]);
    })();

    const sub = supabase
      .channel(`messages:${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Msg]);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(sub);
    };
  }, [sessionId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, typingUsers.length]);

  async function send(text: string, kind: string = "chat") {
    const t = text.trim();
    if (!t) return;
    await supabase.from("messages").insert({
      session_id: sessionId,
      user_id: userId,
      username,
      message: t,
      kind,
    });
  }

  function onChange(v: string) {
    setInput(v);
    channel?.track({ user_id: userId, username, typing: true });
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      channel?.track({ user_id: userId, username, typing: false });
    }, 1500);
  }

  return (
    <div className="flex h-full flex-col glass-strong rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between gap-2">
        <div className="text-sm font-medium">Live chat</div>
        <div className="flex items-center gap-2">
          {isHost ? (
            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-primary">
              <Radio className="h-3 w-3" /> Host
            </span>
          ) : (
            <>
              <span
                className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-widest ${
                  syncStatus === "out_of_sync"
                    ? "text-amber-400"
                    : syncStatus === "syncing"
                      ? "text-sky-400"
                      : "text-emerald-400"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    syncStatus === "out_of_sync"
                      ? "bg-amber-400 animate-pulse"
                      : syncStatus === "syncing"
                        ? "bg-sky-400 animate-pulse"
                        : "bg-emerald-400"
                  }`}
                />
                {syncStatus === "out_of_sync"
                  ? "Out of sync"
                  : syncStatus === "syncing"
                    ? "Syncing…"
                    : "Synced"}
              </span>
              <button
                onClick={onResync}
                title="Resync with host"
                className="glass rounded-full p-1.5 hover:bg-white/10 transition"
              >
                <RefreshCw className="h-3 w-3" />
              </button>
            </>
          )}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-3">
        <AnimatePresence initial={false}>
          {messages.map((m) => {
            const mine = m.user_id === userId;
            if (m.kind === "system") {
              return (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center text-[11px] text-muted-foreground italic"
                >
                  {m.message}
                </motion.div>
              );
            }
            if (m.kind === "reaction") {
              return (
                <motion.div
                  key={m.id}
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className={`flex ${mine ? "justify-end" : "justify-start"}`}
                >
                  <div className="text-3xl">{m.message}</div>
                </motion.div>
              );
            }
            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex flex-col ${mine ? "items-end" : "items-start"}`}
              >
                <div className="text-[10px] text-muted-foreground mb-0.5 px-1">
                  {mine ? "You" : (m.username ?? "Anon")} ·{" "}
                  {new Date(m.created_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-snug ${
                    mine
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "glass rounded-bl-md"
                  }`}
                >
                  {m.message}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {typingUsers.length > 0 && (
          <div className="text-[11px] text-muted-foreground italic flex items-center gap-1">
            <span className="flex gap-0.5">
              <span className="h-1 w-1 rounded-full bg-muted-foreground animate-bounce [animation-delay:-0.3s]" />
              <span className="h-1 w-1 rounded-full bg-muted-foreground animate-bounce [animation-delay:-0.15s]" />
              <span className="h-1 w-1 rounded-full bg-muted-foreground animate-bounce" />
            </span>
            {typingUsers.slice(0, 2).join(", ")} typing…
          </div>
        )}
      </div>

      <div className="px-3 pt-2 pb-1 flex gap-1 flex-wrap">
        {REACTIONS.map((r) => (
          <button
            key={r}
            onClick={() => send(r, "reaction")}
            className="text-lg hover:scale-125 transition-transform"
          >
            {r}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
          setInput("");
        }}
        className="border-t border-white/5 p-3 flex items-center gap-2"
      >
        <Smile className="h-4 w-4 text-muted-foreground" />
        <input
          value={input}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Send a message…"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          maxLength={500}
        />
        <button
          type="submit"
          className="rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:shadow-glow transition disabled:opacity-40"
          disabled={!input.trim()}
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </form>
    </div>
  );
}
