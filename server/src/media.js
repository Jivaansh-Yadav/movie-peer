import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';

const VIDEO_EXTENSIONS = new Set(['.mp4', '.m4v', '.mov']);
const SUBTITLE_EXTENSIONS = new Set(['.vtt', '.srt']);

export function safeResolve(root, requestedName) {
  const rootPath = path.resolve(root);
  const filePath = path.resolve(rootPath, requestedName || '');
  if (!filePath.startsWith(`${rootPath}${path.sep}`) && filePath !== rootPath) {
    return null;
  }
  return filePath;
}

export async function listMediaFiles(root, allowedExtensions) {
  await fs.promises.mkdir(root, { recursive: true });
  const entries = await fs.promises.readdir(root, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && allowedExtensions.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

export function listMovies(root) {
  return listMediaFiles(root, VIDEO_EXTENSIONS);
}

export function listSubtitles(root) {
  return listMediaFiles(root, SUBTITLE_EXTENSIONS);
}

export async function streamVideo(req, res, filePath) {
  const stat = await fs.promises.stat(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Cache-Control', 'no-store');

  if (!range) {
    // Still stream; never read the full file into RAM.
    res.setHeader('Content-Length', fileSize);
    await pipeline(fs.createReadStream(filePath), res);
    return;
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match) {
    res.status(416).setHeader('Content-Range', `bytes */${fileSize}`).end();
    return;
  }

  let start = match[1] ? Number.parseInt(match[1], 10) : 0;
  let end = match[2] ? Number.parseInt(match[2], 10) : fileSize - 1;

  if (!match[1] && match[2]) {
    const suffixLength = Number.parseInt(match[2], 10);
    start = Math.max(fileSize - suffixLength, 0);
    end = fileSize - 1;
  }

  if (start >= fileSize || end >= fileSize || start > end) {
    res.status(416).setHeader('Content-Range', `bytes */${fileSize}`).end();
    return;
  }

  const chunkSize = end - start + 1;
  res.writeHead(206, {
    'Content-Range': `bytes ${start}-${end}/${fileSize}`,
    'Content-Length': chunkSize
  });
  await pipeline(fs.createReadStream(filePath, { start, end }), res);
}

export async function sendSubtitle(res, filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.vtt') {
    res.type('text/vtt').sendFile(filePath);
    return;
  }

  const raw = await fs.promises.readFile(filePath, 'utf8');
  res.type('text/vtt').send(convertSrtToVtt(raw));
}

function convertSrtToVtt(srt) {
  return `WEBVTT\n\n${srt.replace(/\r+/g, '').replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')}`;
}
