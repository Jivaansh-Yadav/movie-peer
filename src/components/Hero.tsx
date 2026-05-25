import { motion } from "framer-motion";
import { Play, Users } from "lucide-react";
import type { TmdbItem } from "@/lib/tmdb.functions";

interface Props {
  item: TmdbItem;
  onPlay: () => void;
}

export function Hero({ item, onPlay }: Props) {
  const backdrop = item.backdrop_path
    ? `https://image.tmdb.org/t/p/original${item.backdrop_path}`
    : null;

  return (
    <section className="relative h-[78vh] min-h-[560px] w-full overflow-hidden">
      {backdrop && (
        <motion.img
          key={item.id}
          src={backdrop}
          alt=""
          initial={{ scale: 1.08, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.6, ease: "easeOut" }}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      <div
        className="absolute inset-0"
        style={{ background: "var(--gradient-hero)" }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/40 to-transparent" />

      <div className="relative z-10 mx-auto flex h-full max-w-7xl flex-col justify-end px-6 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.8 }}
          className="max-w-2xl"
        >
          <div className="mb-4 inline-flex items-center gap-2 rounded-full glass px-3 py-1 text-xs uppercase tracking-[0.2em] text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            Now Trending
          </div>
          <h1
            style={{ fontFamily: "var(--font-display)" }}
            className="text-5xl sm:text-7xl leading-[0.95] mb-5 tracking-tight"
          >
            {item.title}
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground line-clamp-3 max-w-xl mb-7">
            {item.overview}
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={onPlay}
              className="group inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-primary-foreground font-semibold transition-all hover:shadow-glow hover:scale-105"
            >
              <Play className="h-4 w-4 fill-current transition-transform group-hover:translate-x-0.5" />
              Start Watch Party
            </button>
            <div className="inline-flex items-center gap-2 text-sm text-muted-foreground glass rounded-full px-4 py-2">
              <Users className="h-4 w-4" /> Invite friends with one link
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
