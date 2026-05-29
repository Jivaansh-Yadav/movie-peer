# Movie Peer

Movie Peer is a lightweight, self-hosted watch-party app for low-end PCs and trusted private networks such as Tailscale. It direct-plays local MP4 files over normal HTTP range requests, so the host never transcodes, runs ffmpeg, buffers entire movies in memory, or uses WebRTC.

## Features

- Node.js + Express + Socket.IO backend.
- React + Vite + Vidstack frontend.
- Direct-play streaming from `/movies` with `206 Partial Content` support for smooth seeking.
- Host-authoritative play, pause, seek, and playback-rate sync.
- Automatic sync for new users, manual **Sync to Host**, and periodic drift correction.
- Realtime chat, typing indicators, join/leave system messages, and reconnection support.
- One host per room with optional control requests.
- In-memory persistent playback state per room; no database required.
- Subtitle support from `/subtitles` for `.vtt` and `.srt` files.

## Folder structure

```text
/client      React/Vite/Vidstack UI
/server      Express and Socket.IO server
/movies      Put local MP4/M4V/MOV files here (gitignored)
/subtitles   Put VTT/SRT subtitle files here (gitignored)
```

## Setup

1. Install Node.js 20 or newer.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Copy optimized direct-play files into `movies/`:
   - Best format: MP4 container with H264 video and AAC audio.
   - Files are streamed as-is; unsupported client codecs will not be transcoded.
4. Optional: copy `.vtt` or `.srt` subtitle files into `subtitles/`.
5. Start the app for development:

   ```bash
   npm run dev
   ```

6. Open from the host or a Tailscale peer:

   ```text
   http://TAILSCALE_IP:3000
   ```

For a production-style run:

```bash
npm run build
npm start
```

## Example room synchronization flow

1. Alice opens `http://TAILSCALE_IP:3000`, selects a movie, and creates room `AB12CD`.
2. The server stores Alice as `hostId` and initializes in-memory playback state:
   `paused=true`, `currentTime=0`, `playbackRate=1`, `updatedAt=now`.
3. Alice presses play. Only the host emits `playback:update`.
4. The server validates Alice is the host, updates room playback state, and broadcasts `playback:state` with Alice's socket id as `sourceId`.
5. Alice ignores her own reflected event, preventing websocket loops. Other users apply the state.
6. Bob joins the room later. The join acknowledgement includes the effective host playback time so Bob starts near Alice's position.
7. Every few seconds, Bob asks the server for the effective host state. Bob only seeks if drift exceeds the tolerance, avoiding constant micro-seeks on low-end PCs.
8. Bob can click **Sync to Host** for an immediate correction or **Request Control** so Alice can grant host control.

## Performance notes

- No ffmpeg, transcoding, thumbnail generation, media probing, or database writes.
- Express uses `fs.createReadStream()` for full and ranged responses, avoiding full-file memory buffering.
- Socket.IO messages are small JSON state patches.
- Chat history is capped in memory per room.
- Use Tailscale or a trusted LAN; this app intentionally avoids heavyweight auth and cloud services.
