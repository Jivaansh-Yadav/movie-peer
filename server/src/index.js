import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { listMovies, listSubtitles, safeResolve, sendSubtitle, streamVideo } from './media.js';
import { registerSocketHandlers } from './socket.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');
const clientDist = path.join(rootDir, 'client/dist');
const moviesDir = process.env.MOVIES_DIR || path.join(rootDir, 'movies');
const subtitlesDir = process.env.SUBTITLES_DIR || path.join(rootDir, 'subtitles');
const port = Number(process.env.PORT || 3000);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: true },
  transports: ['websocket', 'polling']
});

app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.get('/api/media', async (_req, res, next) => {
  try {
    res.json({ movies: await listMovies(moviesDir), subtitles: await listSubtitles(subtitlesDir) });
  } catch (error) {
    next(error);
  }
});

app.get('/stream/:file', async (req, res, next) => {
  try {
    const filePath = safeResolve(moviesDir, req.params.file);
    if (!filePath) return res.sendStatus(400);
    await streamVideo(req, res, filePath);
  } catch (error) {
    if (error.code === 'ENOENT') return res.sendStatus(404);
    if (!res.headersSent) next(error);
  }
});

app.get('/subtitles/:file', async (req, res, next) => {
  try {
    const filePath = safeResolve(subtitlesDir, req.params.file);
    if (!filePath) return res.sendStatus(400);
    await sendSubtitle(res, filePath);
  } catch (error) {
    if (error.code === 'ENOENT') return res.sendStatus(404);
    next(error);
  }
});

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(clientDist, { maxAge: '1h', etag: true }));
  app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

registerSocketHandlers(io);

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: 'Internal server error' });
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Movie Peer listening on http://0.0.0.0:${port}`);
  console.log(`Movies: ${moviesDir}`);
  console.log(`Subtitles: ${subtitlesDir}`);
});
