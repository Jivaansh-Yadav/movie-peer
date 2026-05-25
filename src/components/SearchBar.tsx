import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Search, X, Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { searchMulti, type TmdbItem } from "@/lib/tmdb.functions";

interface Props {
  onSelect: (item: TmdbItem) => void;
}

export function SearchBar({ onSelect }: Props) {
  const search = useServerFn(searchMulti);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<TmdbItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await search({ data: { query: trimmed } });
        setResults(r);
      } finally {
        setLoading(false);
      }
    }, 280);
    return () => clearTimeout(t);
  }, [q, search]);

  return (
    <div className="relative w-full max-w-xl">
      <div className="flex items-center gap-3 glass-strong rounded-full px-5 py-3 shadow-cinema">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Search movies, shows, anything..."
          className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
        />
        {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        {q && !loading && (
          <button
            onClick={() => {
              setQ("");
              setResults([]);
            }}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <AnimatePresence>
        {open && results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="absolute z-50 mt-3 w-full max-h-[60vh] overflow-y-auto scrollbar-thin glass-strong rounded-2xl p-2 shadow-cinema"
          >
            {results.map((r) => (
              <button
                key={`${r.media_type}-${r.id}`}
                onClick={() => {
                  setOpen(false);
                  onSelect(r);
                }}
                className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-white/5 transition"
              >
                {r.poster_path ? (
                  <img
                    src={`https://image.tmdb.org/t/p/w92${r.poster_path}`}
                    alt=""
                    className="h-16 w-12 rounded-md object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="h-16 w-12 rounded-md bg-muted flex-shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{r.title}</div>
                  <div className="text-xs text-muted-foreground uppercase tracking-widest">
                    {r.media_type} · {(r.release_date ?? r.first_air_date ?? "").slice(0, 4)}
                  </div>
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {open && (
        <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
      )}
    </div>
  );
}
