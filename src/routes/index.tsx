import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Play, Tv2, Film } from "lucide-react";
import { Nav } from "@/components/Nav";
import { Hero } from "@/components/Hero";
import { Row } from "@/components/Row";
import { SearchBar } from "@/components/SearchBar";
import {
  getTrending,
  getPopularMovies,
  getPopularTv,
  getDetails,
  type TmdbItem,
} from "@/lib/tmdb.functions";
import { createRoom } from "@/lib/session.functions";
import { useUser, generateRoomCode } from "@/lib/user-store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MoviePeer — Watch movies together, anywhere" },
      {
        name: "description",
        content:
          "MoviePeer is a cinematic realtime watch-party. Pick a film, share a room code, sync play, pause, chat and reactions with friends.",
      },
      { property: "og:title", content: "MoviePeer — Watch movies together" },
      {
        property: "og:description",
        content: "Cinematic realtime watch parties for movies and shows.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  const trendingFn = useServerFn(getTrending);
  const popularFn = useServerFn(getPopularMovies);
  const popularTvFn = useServerFn(getPopularTv);

  const trending = useQuery({ queryKey: ["trending"], queryFn: () => trendingFn() });
  const movies = useQuery({ queryKey: ["popular-movies"], queryFn: () => popularFn() });
  const shows = useQuery({ queryKey: ["popular-tv"], queryFn: () => popularTvFn() });

  const heroItem = useMemo(
    () => trending.data?.find((i) => i.backdrop_path) ?? trending.data?.[0],
    [trending.data],
  );

  const [picked, setPicked] = useState<TmdbItem | null>(null);

  return (
    <div className="relative min-h-screen">
      <Nav />

      {heroItem ? (
        <Hero item={heroItem} onPlay={() => setPicked(heroItem)} />
      ) : (
        <div className="h-[78vh] min-h-[560px] shimmer" />
      )}

      <div className="relative -mt-32 z-20 mx-auto max-w-7xl px-6">
        <div className="glass-strong rounded-3xl p-6 sm:p-8 shadow-cinema flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="flex-1">
            <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-1">
              Find something to watch
            </div>
            <h2 style={{ fontFamily: "var(--font-display)" }} className="text-2xl">
              Search the entire library
            </h2>
          </div>
          <SearchBar onSelect={setPicked} />
        </div>
      </div>

      {trending.data && (
        <Row title="Trending this week" items={trending.data} onSelect={setPicked} />
      )}
      {movies.data && (
        <Row
          title="Popular movies"
          items={movies.data.map((m) => ({ ...m, media_type: "movie" as const }))}
          onSelect={setPicked}
        />
      )}
      {shows.data && (
        <Row
          title="Popular shows"
          items={shows.data.map((m) => ({ ...m, media_type: "tv" as const }))}
          onSelect={setPicked}
        />
      )}

      <footer className="mx-auto max-w-7xl px-6 py-12 text-center text-xs text-muted-foreground">
        Powered by TMDb · MoviePeer is a watch-party demo, not affiliated with TMDb.
      </footer>

      <AnimatePresence>{picked && <SelectionModal item={picked} onClose={() => setPicked(null)} />}</AnimatePresence>
    </div>
  );
}

function SelectionModal({ item, onClose }: { item: TmdbItem; onClose: () => void }) {
  const navigate = useNavigate();
  const { userId } = useUser();
  const create = useServerFn(createRoom);
  const detailsFn = useServerFn(getDetails);
  const details = useQuery({
    queryKey: ["details", item.media_type, item.id],
    queryFn: () => detailsFn({ data: { id: item.id, mediaType: item.media_type } }),
  });
  const [season, setSeason] = useState(1);
  const [episode, setEpisode] = useState(1);
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    try {
      const code = generateRoomCode();
      await create({
        data: {
          roomCode: code,
          hostId: userId,
          tmdbId: item.id,
          mediaType: item.media_type,
          title: item.title,
          posterPath: item.poster_path,
          backdropPath: item.backdrop_path,
          season: item.media_type === "tv" ? season : undefined,
          episode: item.media_type === "tv" ? episode : undefined,
        },
      });
      navigate({ to: "/session/$roomId", params: { roomId: code } });
    } finally {
      setBusy(false);
    }
  }

  const backdrop = item.backdrop_path
    ? `https://image.tmdb.org/t/p/original${item.backdrop_path}`
    : null;
  const currentSeason = details.data?.seasons?.find((s) => s.season_number === season);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/70 backdrop-blur"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.94, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.94, y: 20 }}
        transition={{ type: "spring", stiffness: 240, damping: 26 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl overflow-hidden rounded-3xl glass-strong shadow-cinema"
      >
        {backdrop && (
          <div className="relative h-56">
            <img src={backdrop} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
          </div>
        )}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 glass rounded-full p-2 hover:bg-white/10 transition"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="p-6 sm:p-8 -mt-12 relative">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-primary mb-2">
            {item.media_type === "tv" ? <Tv2 className="h-3 w-3" /> : <Film className="h-3 w-3" />}
            {item.media_type}
          </div>
          <h3 style={{ fontFamily: "var(--font-display)" }} className="text-4xl mb-3 tracking-tight">
            {item.title}
          </h3>
          <p className="text-sm text-muted-foreground line-clamp-3 mb-5">{item.overview}</p>

          {item.media_type === "tv" && details.data?.seasons && (
            <div className="grid grid-cols-2 gap-3 mb-5">
              <label className="glass rounded-xl px-3 py-2 text-xs">
                <div className="text-muted-foreground mb-1">Season</div>
                <select
                  value={season}
                  onChange={(e) => {
                    setSeason(Number(e.target.value));
                    setEpisode(1);
                  }}
                  className="w-full bg-transparent outline-none text-sm"
                >
                  {details.data.seasons.map((s) => (
                    <option key={s.season_number} value={s.season_number} className="bg-card">
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="glass rounded-xl px-3 py-2 text-xs">
                <div className="text-muted-foreground mb-1">Episode</div>
                <select
                  value={episode}
                  onChange={(e) => setEpisode(Number(e.target.value))}
                  className="w-full bg-transparent outline-none text-sm"
                >
                  {Array.from({ length: currentSeason?.episode_count ?? 1 }, (_, i) => i + 1).map(
                    (ep) => (
                      <option key={ep} value={ep} className="bg-card">
                        Episode {ep}
                      </option>
                    ),
                  )}
                </select>
              </label>
            </div>
          )}

          <button
            disabled={busy}
            onClick={start}
            className="w-full rounded-full bg-primary py-3.5 text-primary-foreground font-semibold inline-flex items-center justify-center gap-2 hover:shadow-glow transition disabled:opacity-50"
          >
            <Play className="h-4 w-4 fill-current" />
            {busy ? "Creating room…" : "Start watch party"}
          </button>
          <p className="mt-3 text-center text-[11px] text-muted-foreground">
            A 6-character room code will be generated. Share it with friends.
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
