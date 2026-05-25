import { Link } from "@tanstack/react-router";
import { Clapperboard } from "lucide-react";
import { JoinRoomPill } from "./JoinRoomPill";

export function Nav() {
  return (
    <header className="fixed top-0 inset-x-0 z-40">
      <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="h-9 w-9 rounded-xl glass-strong grid place-items-center shadow-glow">
            <Clapperboard className="h-4 w-4 text-primary" />
          </div>
          <span
            style={{ fontFamily: "var(--font-display)" }}
            className="text-xl tracking-tight"
          >
            Movie<span className="text-marquee">Peer</span>
          </span>
        </Link>
        <JoinRoomPill />
      </div>
    </header>
  );
}
