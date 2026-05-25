import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const TMDB_BASE = "https://api.themoviedb.org/3";

async function tmdb<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  const token = process.env.TMDB_READ_ACCESS_TOKEN;
  if (!token) throw new Error("TMDB_READ_ACCESS_TOKEN missing");
  const url = new URL(TMDB_BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}`, accept: "application/json" },
  });
  if (!res.ok) throw new Error(`TMDb ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

export interface TmdbItem {
  id: number;
  media_type: "movie" | "tv";
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  release_date?: string;
  first_air_date?: string;
}

function normalize(raw: any, fallbackType?: "movie" | "tv"): TmdbItem {
  const media_type = (raw.media_type ?? fallbackType ?? "movie") as "movie" | "tv";
  return {
    id: raw.id,
    media_type,
    title: raw.title ?? raw.name ?? "Untitled",
    overview: raw.overview ?? "",
    poster_path: raw.poster_path ?? null,
    backdrop_path: raw.backdrop_path ?? null,
    vote_average: raw.vote_average ?? 0,
    release_date: raw.release_date,
    first_air_date: raw.first_air_date,
  };
}

export const getTrending = createServerFn({ method: "GET" }).handler(async () => {
  const data = await tmdb<{ results: any[] }>("/trending/all/week", { language: "en-US" });
  return data.results
    .filter((r) => r.media_type === "movie" || r.media_type === "tv")
    .map((r) => normalize(r))
    .slice(0, 20);
});

export const getPopularMovies = createServerFn({ method: "GET" }).handler(async () => {
  const data = await tmdb<{ results: any[] }>("/movie/popular", { language: "en-US" });
  return data.results.map((r) => normalize(r, "movie")).slice(0, 20);
});

export const getPopularTv = createServerFn({ method: "GET" }).handler(async () => {
  const data = await tmdb<{ results: any[] }>("/tv/popular", { language: "en-US" });
  return data.results.map((r) => normalize(r, "tv")).slice(0, 20);
});

export const searchMulti = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ query: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data }) => {
    const res = await tmdb<{ results: any[] }>("/search/multi", {
      query: data.query,
      language: "en-US",
      include_adult: "false",
    });
    return res.results
      .filter((r) => r.media_type === "movie" || r.media_type === "tv")
      .map((r) => normalize(r))
      .slice(0, 24);
  });

export const getDetails = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z.object({
      id: z.number().int().positive(),
      mediaType: z.enum(["movie", "tv"]),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const raw = await tmdb<any>(`/${data.mediaType}/${data.id}`, { language: "en-US" });
    const item = normalize(raw, data.mediaType);
    let seasons: { season_number: number; episode_count: number; name: string }[] | undefined;
    if (data.mediaType === "tv") {
      seasons = (raw.seasons ?? [])
        .filter((s: any) => s.season_number > 0)
        .map((s: any) => ({
          season_number: s.season_number,
          episode_count: s.episode_count,
          name: s.name,
        }));
    }
    return {
      ...item,
      runtime: raw.runtime,
      genres: (raw.genres ?? []).map((g: any) => g.name) as string[],
      tagline: raw.tagline as string | undefined,
      seasons,
    };
  });
