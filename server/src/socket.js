import {
  appendChatMessage,
  appendSystemMessage,
  createRoom,
  getEffectivePlayback,
  normalizeRoomId,
  publicRoom,
  rooms,
  updatePlayback
} from './rooms.js';

export function registerSocketHandlers(io) {
  io.on('connection', (socket) => {
    socket.data.name = `Guest-${socket.id.slice(0, 4)}`;

    socket.on('room:create', ({ name, movie, subtitle } = {}, ack) => {
      if (!movie) return ack?.({ ok: false, error: 'Choose a movie first.' });
      socket.data.name = cleanName(name);
      const room = createRoom({ hostId: socket.id, hostName: socket.data.name, movie, subtitle });
      socket.join(room.id);
      socket.data.roomId = room.id;
      appendSystemMessage(room, `${socket.data.name} created the room.`);
      ack?.({ ok: true, room: publicRoom(room) });
      io.to(room.id).emit('room:update', publicRoom(room));
    });

    socket.on('room:join', ({ roomId, name } = {}, ack) => {
      const normalizedRoomId = normalizeRoomId(roomId);
      const room = rooms.get(normalizedRoomId);
      if (!room) return ack?.({ ok: false, error: 'Room not found.' });

      socket.data.name = cleanName(name);
      socket.join(room.id);
      socket.data.roomId = room.id;
      room.members.set(socket.id, { id: socket.id, name: socket.data.name, isHost: socket.id === room.hostId });
      appendSystemMessage(room, `${socket.data.name} joined.`);

      ack?.({ ok: true, room: publicRoom(room), playback: getEffectivePlayback(room.playback) });
      io.to(room.id).emit('room:update', publicRoom(room));
      io.to(room.id).emit('chat:message', room.chat.at(-1));
    });

    socket.on('playback:update', (payload = {}) => {
      const room = getSocketRoom(socket);
      if (!room || socket.id !== room.hostId) return;

      // Host-authoritative: only host updates become room truth. The sender id
      // lets clients ignore their own reflected event and prevents event loops.
      const playback = updatePlayback(room, payload.playback || payload);
      io.to(room.id).emit('playback:state', { playback, sourceId: socket.id, reason: payload.reason || 'host-update' });
    });

    socket.on('playback:sync-request', (ack) => {
      const room = getSocketRoom(socket);
      if (!room) return ack?.({ ok: false, error: 'Join a room first.' });
      ack?.({ ok: true, playback: getEffectivePlayback(room.playback), hostId: room.hostId });
    });

    socket.on('control:request', () => {
      const room = getSocketRoom(socket);
      if (!room || socket.id === room.hostId) return;
      const request = { id: socket.id, name: socket.data.name, at: Date.now() };
      room.controlRequests.set(socket.id, request);
      io.to(room.hostId).emit('control:requested', request);
      io.to(room.id).emit('room:update', publicRoom(room));
    });

    socket.on('control:grant', ({ memberId } = {}) => {
      const room = getSocketRoom(socket);
      if (!room || socket.id !== room.hostId || !room.members.has(memberId)) return;
      transferHost(io, room, memberId);
    });

    socket.on('chat:message', ({ text } = {}) => {
      const room = getSocketRoom(socket);
      const cleanText = String(text || '').trim().slice(0, 500);
      if (!room || !cleanText) return;
      const message = appendChatMessage(room, { type: 'user', name: socket.data.name, text: cleanText, memberId: socket.id });
      io.to(room.id).emit('chat:message', message);
    });

    socket.on('chat:typing', ({ isTyping } = {}) => {
      const room = getSocketRoom(socket);
      if (!room) return;
      socket.to(room.id).emit('chat:typing', { memberId: socket.id, name: socket.data.name, isTyping: Boolean(isTyping) });
    });

    socket.on('disconnect', () => handleLeave(io, socket));
  });
}

function getSocketRoom(socket) {
  const roomId = socket.data.roomId;
  return roomId ? rooms.get(roomId) : null;
}

function handleLeave(io, socket) {
  const room = getSocketRoom(socket);
  if (!room) return;

  const member = room.members.get(socket.id);
  room.members.delete(socket.id);
  room.controlRequests.delete(socket.id);
  if (member) appendSystemMessage(room, `${member.name} left.`);

  if (room.members.size === 0) {
    rooms.delete(room.id);
    return;
  }

  if (socket.id === room.hostId) {
    const nextHostId = room.members.keys().next().value;
    transferHost(io, room, nextHostId, false);
  }

  io.to(room.id).emit('chat:message', room.chat.at(-1));
  io.to(room.id).emit('room:update', publicRoom(room));
}

function transferHost(io, room, nextHostId, announce = true) {
  const oldHost = room.members.get(room.hostId);
  const nextHost = room.members.get(nextHostId);
  if (!nextHost) return;

  if (oldHost) oldHost.isHost = false;
  nextHost.isHost = true;
  room.hostId = nextHostId;
  room.controlRequests.clear();
  if (announce) appendSystemMessage(room, `${nextHost.name} is now host.`);
  io.to(room.id).emit('chat:message', room.chat.at(-1));
  io.to(room.id).emit('room:update', publicRoom(room));
  io.to(nextHostId).emit('host:assigned', { playback: getEffectivePlayback(room.playback) });
}

function cleanName(name) {
  return String(name || 'Guest').trim().slice(0, 32) || 'Guest';
}
