import { motion } from "framer-motion";
import { Crown, Users, Copy, Check, Edit2 } from "lucide-react";
import { useState } from "react";
import { useUser } from "@/lib/user-store";

interface Presence {
  user_id: string;
  username: string;
}

export function PresenceBar({
  roomCode,
  hostId,
  presences,
  onTransferHost,
  onRename,
}: {
  roomCode: string;
  hostId: string;
  presences: Presence[];
  onTransferHost: (userId: string) => void;
  onRename: (name: string) => void;
}) {
  const { userId, username } = useUser();
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(username);
  const iAmHost = userId === hostId;

  function copyInvite() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="glass-strong rounded-2xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            Room
          </div>
          <div
            style={{ fontFamily: "var(--font-display)" }}
            className="text-3xl tracking-tight text-marquee"
          >
            {roomCode}
          </div>
        </div>
        <button
          onClick={copyInvite}
          className="glass rounded-full px-3 py-2 text-xs inline-flex items-center gap-1.5 hover:bg-white/10 transition"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Invite"}
        </button>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Users className="h-3 w-3" />
          {presences.length} watching
        </span>
        {editing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onRename(draft);
              setEditing(false);
            }}
          >
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => {
                onRename(draft);
                setEditing(false);
              }}
              className="bg-transparent border-b border-white/20 outline-none text-xs w-32"
              maxLength={32}
            />
          </form>
        ) : (
          <button
            onClick={() => {
              setDraft(username);
              setEditing(true);
            }}
            className="inline-flex items-center gap-1 hover:text-foreground transition"
          >
            <Edit2 className="h-3 w-3" /> {username}
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {presences.map((p) => {
          const isHost = p.user_id === hostId;
          const isMe = p.user_id === userId;
          return (
            <motion.div
              key={p.user_id}
              layout
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={`glass rounded-full pl-1 pr-3 py-1 flex items-center gap-2 text-xs ${
                isMe ? "ring-1 ring-primary" : ""
              }`}
            >
              <div
                className={`h-5 w-5 rounded-full grid place-items-center text-[10px] font-semibold ${
                  isHost ? "bg-primary text-primary-foreground" : "bg-white/10"
                }`}
              >
                {p.username.charAt(0).toUpperCase()}
              </div>
              <span className="truncate max-w-[100px]">{p.username}</span>
              {isHost && <Crown className="h-3 w-3 text-primary" />}
              {iAmHost && !isHost && (
                <button
                  onClick={() => onTransferHost(p.user_id)}
                  className="text-muted-foreground hover:text-primary"
                  title="Transfer host"
                >
                  <Crown className="h-3 w-3" />
                </button>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
