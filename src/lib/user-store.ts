import { create } from "zustand";
import { persist } from "zustand/middleware";

function rid(len = 12) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

const ADJ = ["Cinematic", "Neon", "Quiet", "Velvet", "Midnight", "Golden", "Stellar", "Crimson", "Lunar", "Ember"];
const NOUN = ["Critic", "Director", "Cinephile", "Reel", "Auteur", "Producer", "Star", "Frame", "Lens", "Editor"];
function defaultName() {
  return `${ADJ[Math.floor(Math.random() * ADJ.length)]} ${NOUN[Math.floor(Math.random() * NOUN.length)]}`;
}

interface UserState {
  userId: string;
  username: string;
  setUsername: (n: string) => void;
}

export const useUser = create<UserState>()(
  persist(
    (set) => ({
      userId: rid(),
      username: defaultName(),
      setUsername: (n) => set({ username: n.trim().slice(0, 32) || defaultName() }),
    }),
    { name: "moviepeer-user" },
  ),
);

export function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}
