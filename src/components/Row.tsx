import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MovieCard } from "./MovieCard";
import type { TmdbItem } from "@/lib/tmdb.functions";

interface Props {
  title: string;
  items: TmdbItem[];
  onSelect: (item: TmdbItem) => void;
}

export function Row({ title, items, onSelect }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: 1 | -1) => {
    ref.current?.scrollBy({ left: dir * 700, behavior: "smooth" });
  };

  return (
    <section className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        <div className="flex gap-2">
          <button
            onClick={() => scroll(-1)}
            className="glass rounded-full p-2 hover:bg-white/10 transition"
            aria-label="Scroll left"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => scroll(1)}
            className="glass rounded-full p-2 hover:bg-white/10 transition"
            aria-label="Scroll right"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div
        ref={ref}
        className="flex gap-4 overflow-x-auto scrollbar-hidden snap-x snap-mandatory pb-3 -mx-2 px-2"
      >
        {items.map((item) => (
          <div key={`${item.media_type}-${item.id}`} className="snap-start">
            <MovieCard item={item} onSelect={onSelect} />
          </div>
        ))}
      </div>
    </section>
  );
}
