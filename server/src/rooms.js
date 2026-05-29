const ROOM_ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_CHAT_MESSAGES = 80;

export const rooms = new Map();

export function createRoomId() {
  let id = '';
  for (let i = 0; i < 6; i += 1) {
    id += ROOM_ID_CHARS[Math.floor(Math.random() * ROOM_ID_CHARS.length)];
  }
  return rooms.has(id) ? createRoomId() : id;
}

export function normalizeRoomId(roomId) {
  return String(roomId || '').trim().toUpperCase().slice(0, 16);
}

export function publicRoom(room) {
  return {
    id: room.id,
    hostId: room.hostId,
    hostName: room.members.get(room.hostId)?.name || 'Host',
    movie: room.movie,
    subtitle: room.subtitle,
    playback: room.playback,
    members: [...room.members.values()],
    chat: room.chat,
    controlRequests: [...room.controlRequests.values()]
  };
}

export function createRoom({ hostId, hostName, movie, subtitle }) {
  const room = {
    id: createRoomId(),
    hostId,
    movie,
    subtitle: subtitle || '',
    members: new Map([[hostId, { id: hostId, name: hostName, isHost: true }]]),
    controlRequests: new Map(),
    chat: [],
    playback: {
      paused: true,
      currentTime: 0,
      playbackRate: 1,
      updatedAt: Date.now()
    }
  };
  rooms.set(room.id, room);
  return room;
}

export function appendSystemMessage(room, text) {
  appendChatMessage(room, { type: 'system', name: 'System', text });
}

export function appendChatMessage(room, message) {
  const chatMessage = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    at: Date.now(),
    ...message
  };
  room.chat.push(chatMessage);
  if (room.chat.length > MAX_CHAT_MESSAGES) {
    room.chat.splice(0, room.chat.length - MAX_CHAT_MESSAGES);
  }
  return chatMessage;
}

export function getEffectivePlayback(playback) {
  if (playback.paused) return { ...playback, updatedAt: Date.now() };
  const elapsedSeconds = (Date.now() - playback.updatedAt) / 1000;
  return {
    ...playback,
    currentTime: Math.max(0, playback.currentTime + elapsedSeconds * playback.playbackRate),
    updatedAt: Date.now()
  };
}

export function updatePlayback(room, patch) {
  const base = getEffectivePlayback(room.playback);
  room.playback = {
    paused: typeof patch.paused === 'boolean' ? patch.paused : base.paused,
    currentTime: Number.isFinite(patch.currentTime) ? Math.max(0, patch.currentTime) : base.currentTime,
    playbackRate: Number.isFinite(patch.playbackRate) ? clampRate(patch.playbackRate) : base.playbackRate,
    updatedAt: Date.now()
  };
  return room.playback;
}

function clampRate(rate) {
  return Math.min(4, Math.max(0.25, rate));
}
