import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

function sb() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } },
  );
}

export const createRoom = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      roomCode: z.string().length(6),
      hostId: z.string().min(1).max(64),
      tmdbId: z.number().int().positive(),
      mediaType: z.enum(["movie", "tv"]),
      title: z.string().max(300),
      posterPath: z.string().max(200).nullable(),
      backdropPath: z.string().max(200).nullable(),
      season: z.number().int().positive().optional(),
      episode: z.number().int().positive().optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const supabase = sb();
    const { data: row, error } = await supabase
      .from("sessions")
      .insert({
        room_code: data.roomCode,
        host_id: data.hostId,
        tmdb_id: data.tmdbId,
        media_type: data.mediaType,
        title: data.title,
        poster_path: data.posterPath,
        backdrop_path: data.backdropPath,
        season: data.season ?? null,
        episode: data.episode ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const getRoom = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ roomCode: z.string().length(6) }).parse(d))
  .handler(async ({ data }) => {
    const supabase = sb();
    const { data: row, error } = await supabase
      .from("sessions")
      .select("*")
      .eq("room_code", data.roomCode.toUpperCase())
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });
