import { motion } from "framer-motion";
import { Play, Star } from "lucide-react";
import type { TmdbItem } from "@/lib/tmdb.functions";

interface Props {
  item: TmdbItem;
  onSelect: (item: TmdbItem) => void;
  priority?: boolean;
}

export function MovieCard({ item, onSelect }: Props) {
  const poster = item.poster_path
    ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
    : null;
  const year = (item.release_date ?? item.first_air_date ?? "").slice(0, 4);

  return (
    <motion.button
      whileHover={{ y: -6, scale: 1.03 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 300, damping: 22 }}
      onClick={() => onSelect(item)}
      className="group relative aspect-[2/3] w-[170px] sm:w-[200px] flex-shrink-0 overflow-hidden rounded-2xl glass shadow-cinema text-left"
    >
      {poster ? (
        <img
          src={poster}
          alt={item.title}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
      ) : (
        <div className="absolute inset-0 bg-muted" />
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent opacity-90" />

      <div className="absolute top-2 right-2 glass-strong rounded-full px-2 py-0.5 text-[10px] font-medium flex items-center gap-1">
        <Star className="h-2.5 w-2.5 fill-primary text-primary" />
        {item.vote_average.toFixed(1)}
      </div>

      <div className="absolute top-2 left-2 glass-strong rounded-full px-2 py-0.5 text-[10px] uppercase tracking-widest">
        {item.media_type}
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-3 space-y-1">
        <div className="line-clamp-2 text-sm font-semibold leading-tight">{item.title}</div>
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{year || "—"}</span>
          <span className="flex items-center gap-1 text-primary opacity-0 transition-opacity group-hover:opacity-100">
            <Play className="h-3 w-3 fill-primary" /> Watch together
          </span>
        </div>
      </div>
    </motion.button>
  );
}
