import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { LogIn } from "lucide-react";

export function JoinRoomPill() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const c = code.trim().toUpperCase();
        if (c.length === 6) navigate({ to: "/session/$roomId", params: { roomId: c } });
      }}
      className="flex items-center gap-2 glass rounded-full pl-4 pr-1 py-1"
    >
      <LogIn className="h-3.5 w-3.5 text-muted-foreground" />
      <input
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
        placeholder="ROOM CODE"
        className="w-24 bg-transparent text-xs tracking-[0.3em] outline-none placeholder:text-muted-foreground/60"
      />
      <button
        type="submit"
        className="rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:shadow-glow transition"
      >
        Join
      </button>
    </form>
  );
}
