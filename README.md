<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:12040a,55:3f0d1e,100:e11d48&height=235&section=header&text=Movie%20Peer&fontSize=46&fontColor=fff1f4&fontAlignY=40&desc=Watch%20together%2C%20stay%20within%20two%20seconds&descSize=17&descAlignY=62&animation=twinkling" alt="Movie Peer" width="100%">

<img src="https://readme-typing-svg.demolab.com?font=JetBrains+Mono&weight=500&size=19&duration=3200&pause=900&color=fb7185&center=true&vCenter=true&width=680&lines=One%20host%2C%20one%20truth%2C%20everyone%20else%20follows;Drift%20past%202s%20and%20the%20player%20resyncs%20itself;Chat%2C%20reactions%20and%20typing%20in%20the%20same%20room" alt="Typing animation" />

<br />

<img src="https://img.shields.io/badge/Status-private%20build-e11d48?style=flat-square&labelColor=12040a" alt="Private build" />
<img src="https://img.shields.io/badge/Stack-TanStack%20Start%20%2B%20React%2019-fb7185?style=flat-square&labelColor=12040a" alt="TanStack Start and React 19" />
<img src="https://img.shields.io/badge/Realtime-Supabase-f43f5e?style=flat-square&labelColor=12040a" alt="Supabase realtime" />
<img src="https://img.shields.io/badge/Metadata-TMDB-9f1239?style=flat-square&labelColor=12040a" alt="TMDB" />

</div>

<br />

<div align="center">

<sub><b>Not deployed.</b> A private build of a watch-party app: rooms with codes, a host-authoritative player, and a sidebar that makes watching alone feel odd.</sub>

</div>

---

<div align="center">

## What it is

</div>

A watch-together room. Someone creates a room, picks a film or an episode, and shares a six-character code. Everyone who joins sees the same player, the same timestamp within a couple of seconds, and a chat panel on the right with reactions built for the specific moment a plot twist lands.

The hard part of this product is not the video — it is **agreement**. Two browsers will never play at exactly the same speed, and a player that treats every device as its own authority ends with four people shouting "pause, you're ahead". This app solves it by refusing to negotiate: **one host owns the truth**, everyone else follows it, and drift is treated as a bug to correct rather than a state to average out.

<div align="center">

<sub>Films and episodes come from <b>TMDB</b> (search, backdrop, seasons); the stream is played by <b>VidKing</b> in an iframe. Everything else — rooms, sync, chat — is this repository.</sub>

</div>

---

<div align="center">

## The loop

</div>

<ol>
<li><b>Pick something.</b> Search TMDB, open a film or a series, choose a season and episode. The hero carries the backdrop and the metadata.</li>
<li><b>Open a room.</b> The room gets a short code and a row in Postgres with the host's id and the chosen media. The creator is the host by definition.</li>
<li><b>Join with the code.</b> A member's player mounts already seeking to the host's current timestamp — the persisted snapshot, plus however long has passed since it was written.</li>
<li><b>Watch.</b> Play, pause and seek are host actions. Members see a sync badge: <b>synced</b>, <b>syncing</b> or <b>out of sync</b>.</li>
<li><b>Talk.</b> Chat loads the last 200 messages, reactions are one tap, and a typing indicator shows who is composing.</li>
</ol>

<div align="center">

## What is inside

</div>

<ul>
<li><b>Host-authoritative sync</b> — the host broadcasts instantly on play/pause/seek and a throttled tick every 2.5 s. Members compute their own drift against that.</li>
<li><b>Hard resync at 2 seconds</b> — past the threshold the iframe reloads at a computed position rather than trying to seek across the gap.</li>
<li><b>Late joiners land in the right place</b> — the snapshot is persisted with the moment it was written, so the join position is <code>currentTime + elapsed</code>, not a stale number.</li>
<li><b>Host handover</b> — if the host leaves, ownership transfers to another member and the room keeps going.</li>
<li><b>Chat with reactions</b> — ❤️ 🔥 😂 😮 👏 🍿, 200-message history, typing indicators, and a presence bar of who is in the room.</li>
<li><b>Identity without an account</b> — a display name kept in <code>localStorage</code>; the app is for a film night, not a profile.</li>
<li><b>Detailed metadata</b> — title, backdrop, media type, season and episode all live on the session row, so a rejoined room reopens on the right episode even days later.</li>
<li><b>Error capture</b> — client errors are reported to a server route with the route path, no third-party SDK.</li>
</ul>

---

<div align="center">

## Stack

</div>

<ul>
<li><b>TanStack Start</b> — file-based routes, server functions for TMDB (the API key never reaches the browser), streaming SSR.</li>
<li><b>React 19</b> — the player surface is refs and effects; the chat is state.</li>
<li><b>Supabase</b> — Postgres for sessions and messages, Realtime broadcast for playback events, presence for the member bar.</li>
<li><b>TMDB</b> — search and metadata through a server function, so the client never holds a token.</li>
<li><b>VidKing</b> — the actual playback iframe; this app owns the timeline, not the codec.</li>
<li><b>Tailwind CSS</b> — a dark-first cinema palette.</li>
</ul>

<div align="center">

<img src="https://skillicons.dev/icons?i=react,ts,tailwind,supabase,postgres,vercel,git" alt="React, TypeScript, Tailwind, Supabase, Postgres, Vercel, Git" />

</div>

---

<div align="center">

## Under the hood

</div>

<details>
<summary><b>Why broadcasting a timestamp is not enough</b></summary>

<br />

<p>The naive design is "the host sends its <code>currentTime</code> and everyone seeks to it". That fails for a reason that has nothing to do with accuracy: seeking a video element is expensive and visible. Every correction is a stutter, and a player that corrects every 2.5 seconds is worse than one that drifts.</p>

<p>So corrections are graduated. Broadcast events carry an <code>updatedAt</code>, and seconds elapse between the event and the member receiving it — which means the expected position is not <code>currentTime</code>, but:</p>

<pre><code>const drift = state.paused ? 0 : Math.max(0, elapsed);
return Math.max(0, state.currentTime + drift);</code></pre>

<p>A member only acts when <code>Math.abs(expected - local) &gt; 2</code>. Small drift is ignored entirely: the badge admits it, the player does not fight it.</p>

</details>

<details>
<summary><b>The 2-second line, and what happens past it</b></summary>

<br />

<p>Above the threshold the choice is between seeking and remounting the iframe. Seeking in a cross-origin embed is unreliable — the app cannot reach into the player's element to ask where it is, so it cannot verify a seek took effect. Remounting is unambiguous: the iframe's source is rebuilt with the computed position, and the player starts at a known timestamp.</p>

<pre><code>const OUT_OF_SYNC_DRIFT = 2;        // seconds
const HOST_TICK_INTERVAL_MS = 2500; // throttled heartbeat</code></pre>

<p>The cost is a visible reload; the benefit is that "out of sync" is always temporary. That trade is the whole reason the badge has three states instead of a spinner.</p>

</details>

<details>
<summary><b>The session row is the late-join contract</b></summary>

<br />

<p>A room is a row, and that row is the only thing a newcomer reads on arrival:</p>

<pre><code>create table sessions (
  room_code          text,
  host_id            uuid,
  tmdb_id            integer,
  media_type         text,
  title              text,
  backdrop_path      text,
  season             integer,
  episode            integer,
  playback_time      numeric,
  playback_state     text,
  -- migration 20260526090000
  sync_version       integer not null default 0,
  sync_progress      numeric,
  sync_paused        boolean,
  sync_updated_at    timestamptz,
  sync_request_nonce bigint
)</code></pre>

<p><code>sync_version</code> orders the broadcasts so an out-of-order delivery cannot roll the room back; <code>sync_updated_at</code> is what makes <code>currentTime + elapsed</code> correct for someone joining mid-film; <code>sync_request_nonce</code> lets a member ask for a fresh snapshot without inventing an event type.</p>

<p>Because <code>title</code>, <code>season</code> and <code>episode</code> are on the row, a room reopened tomorrow does not need TMDB to know what it was showing.</p>

</details>

<details>
<summary><b>Chat that behaves like a room full of people</b></summary>

<br />

<p>Messages load the <b>last 200</b> — a watch party is a present-tense space, and paginating to the first message of a two-year-old room is not a feature anyone wants. Reactions are fixed shortcodes rather than free emoji, which keeps the bar small enough to tap during a scene. Typing indicators are presence-based and expire on their own, so a closed tab cannot leave someone "typing…" forever.</p>

<p>Ownership moves when the host disconnects: <code>host_id</code> is updated to another member, and the sync hook re-runs with <code>isHost</code> flipped. No room is ever hostless.</p>

</details>

---

<div align="center">

## Project structure

</div>

<pre><code>movie-peer/
├── src/routes/
│   ├── __root.tsx              # shell, nav, toast
│   ├── index.tsx               # search, rows, hero
│   └── session.$roomId.tsx     # player + chat + presence
├── src/components/             # Hero · Row · MovieCard · SearchBar · ChatPanel · Nav
├── src/lib/
│   ├── usePlaybackSync.ts      # host authority, drift, hard resync
│   ├── tmdb.functions.ts       # server-side TMDB access
│   └── user-store.ts           # display name in localStorage
├── src/integrations/supabase/  # client, server client, auth middleware
└── supabase/migrations/        # sessions · messages · sync snapshot</code></pre>

---

<div align="center">

## Run it

</div>

<pre><code>git clone https://github.com/Jivaansh-Yadav/movie-peer.git
cd movie-peer
bun install
bun run dev</code></pre>

<p>Needs a Supabase project (URL + anon key) with the migrations applied, and a TMDB API key for the server function. Without them the browsing page still renders from cached metadata, but rooms cannot be created.</p>

<div align="center">

<sub>Designed for two people on a call and six people in a group chat. The badge tells the truth: if it says out of sync, it is about to fix itself.</sub>

</div>

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:12040a,55:3f0d1e,100:e11d48&height=110&section=footer&reversal=true" alt="" width="100%">
