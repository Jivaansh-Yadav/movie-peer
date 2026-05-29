import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { io } from 'socket.io-client';
import 'vidstack/styles/base.css';
import { MediaPlayer, MediaOutlet, MediaCommunitySkin } from '@vidstack/react';
import './styles.css';

const DRIFT_CHECK_MS = 4000;
const DRIFT_TOLERANCE_SECONDS = 1.2;
const socket = io('/', { autoConnect: false, reconnection: true, reconnectionAttempts: Infinity });

function App() {
  const playerRef = useRef(null);
  const suppressEmitUntil = useRef(0);
  const [connected, setConnected] = useState(false);
  const [media, setMedia] = useState({ movies: [], subtitles: [] });
  const [name, setName] = useState(localStorage.getItem('movie-peer-name') || 'Guest');
  const [roomIdInput, setRoomIdInput] = useState('');
  const [selectedMovie, setSelectedMovie] = useState('');
  const [selectedSubtitle, setSelectedSubtitle] = useState('');
  const [room, setRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chatText, setChatText] = useState('');
  const [typingUsers, setTypingUsers] = useState(new Map());
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const isHost = room?.hostId === socket.id;
  const videoSrc = room?.movie ? `/stream/${encodeURIComponent(room.movie)}` : '';
  const subtitleSrc = room?.subtitle ? `/subtitles/${encodeURIComponent(room.subtitle)}` : '';

  useEffect(() => {
    fetch('/api/media').then((res) => res.json()).then((data) => {
      setMedia(data);
      setSelectedMovie(data.movies?.[0] || '');
      setSelectedSubtitle(data.subtitles?.[0] || '');
    }).catch(() => setError('Could not load media list.'));

    socket.connect();
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('room:update', (nextRoom) => {
      setRoom(nextRoom);
      setMessages(nextRoom.chat || []);
    });
    socket.on('chat:message', (message) => setMessages((prev) => appendUnique(prev, message)));
    socket.on('chat:typing', ({ memberId, name: typingName, isTyping }) => {
      setTypingUsers((prev) => {
        const next = new Map(prev);
        if (isTyping) next.set(memberId, typingName);
        else next.delete(memberId);
        return next;
      });
    });
    socket.on('playback:state', ({ playback, sourceId }) => {
      if (sourceId === socket.id) return;
      applyPlayback(playback, false);
    });
    socket.on('host:assigned', ({ playback }) => {
      setNotice('You are now the host.');
      applyPlayback(playback, false);
    });
    socket.on('control:requested', ({ name: requester }) => setNotice(`${requester} requested playback control.`));

    return () => socket.disconnect();
  }, []);

  useEffect(() => {
    if (!room || isHost) return;
    const interval = window.setInterval(() => syncToHost(false), DRIFT_CHECK_MS);
    return () => window.clearInterval(interval);
  }, [room?.id, isHost]);

  function persistName() {
    localStorage.setItem('movie-peer-name', name);
  }

  function createRoom() {
    persistName();
    socket.emit('room:create', { name, movie: selectedMovie, subtitle: selectedSubtitle }, handleRoomAck);
  }

  function joinRoom() {
    persistName();
    socket.emit('room:join', { name, roomId: roomIdInput }, handleRoomAck);
  }

  function handleRoomAck(response) {
    if (!response?.ok) return setError(response?.error || 'Room action failed.');
    setError('');
    setRoom(response.room);
    setMessages(response.room.chat || []);
    if (response.playback) requestAnimationFrame(() => applyPlayback(response.playback, false));
  }

  function emitPlayback(reason) {
    if (!isHost || Date.now() < suppressEmitUntil.current) return;
    const player = playerRef.current;
    if (!player) return;
    socket.emit('playback:update', {
      reason,
      playback: {
        paused: player.paused,
        currentTime: player.currentTime || 0,
        playbackRate: player.playbackRate || 1
      }
    });
  }

  function applyPlayback(playback, onlyIfDrifting) {
    const player = playerRef.current;
    if (!player || !playback) return;

    const targetTime = playback.paused
      ? playback.currentTime
      : playback.currentTime + ((Date.now() - playback.updatedAt) / 1000) * playback.playbackRate;
    const drift = Math.abs((player.currentTime || 0) - targetTime);

    if (!onlyIfDrifting || drift > DRIFT_TOLERANCE_SECONDS) {
      suppressEmitUntil.current = Date.now() + 700;
      player.currentTime = Math.max(0, targetTime);
    }
    if (Math.abs((player.playbackRate || 1) - playback.playbackRate) > 0.01) player.playbackRate = playback.playbackRate;
    if (playback.paused && !player.paused) player.pause();
    if (!playback.paused && player.paused) player.play().catch(() => {});
  }

  function syncToHost(showNotice = true) {
    socket.emit('playback:sync-request', (response) => {
      if (!response?.ok) return;
      applyPlayback(response.playback, true);
      if (showNotice) setNotice('Synced to host.');
    });
  }

  function sendChat(event) {
    event.preventDefault();
    if (!chatText.trim()) return;
    socket.emit('chat:message', { text: chatText });
    setChatText('');
    socket.emit('chat:typing', { isTyping: false });
  }

  function updateTyping(value) {
    setChatText(value);
    socket.emit('chat:typing', { isTyping: Boolean(value.trim()) });
  }

  const typingLabel = useMemo(() => [...typingUsers.values()].slice(0, 2).join(', '), [typingUsers]);

  return (
    <main>
      <header className="topbar">
        <div>
          <h1>Movie Peer</h1>
          <p>Direct-play watch parties for Tailscale LANs.</p>
        </div>
        <span className={connected ? 'status online' : 'status'}>{connected ? 'Connected' : 'Reconnecting…'}</span>
      </header>

      {!room && (
        <section className="card lobby">
          <label>Your name<input value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label>Movie<select value={selectedMovie} onChange={(event) => setSelectedMovie(event.target.value)}>{media.movies.map((movie) => <option key={movie}>{movie}</option>)}</select></label>
          <label>Subtitle<select value={selectedSubtitle} onChange={(event) => setSelectedSubtitle(event.target.value)}><option value="">None</option>{media.subtitles.map((subtitle) => <option key={subtitle}>{subtitle}</option>)}</select></label>
          <button onClick={createRoom} disabled={!selectedMovie}>Create room</button>
          <div className="join-row"><input placeholder="Room ID" value={roomIdInput} onChange={(event) => setRoomIdInput(event.target.value.toUpperCase())} /><button onClick={joinRoom}>Join</button></div>
          {error && <p className="error">{error}</p>}
          {!media.movies.length && <p className="hint">Put H264/AAC MP4 files in the <code>/movies</code> folder.</p>}
        </section>
      )}

      {room && (
        <section className="watch-grid">
          <div className="player-card">
            <div className="room-strip"><strong>Room {room.id}</strong><span>{isHost ? 'You control playback' : `Host: ${room.hostName}`}</span><button onClick={() => syncToHost(true)}>Sync to Host</button>{!isHost && <button onClick={() => socket.emit('control:request')}>Request Control</button>}</div>
            <MediaPlayer
              ref={playerRef}
              title={room.movie}
              src={videoSrc}
              playsInline
              controls
              onPlay={() => emitPlayback('play')}
              onPause={() => emitPlayback('pause')}
              onSeeked={() => emitPlayback('seek')}
              onRateChange={() => emitPlayback('rate')}
            >
              <MediaOutlet>
                {subtitleSrc && <track src={subtitleSrc} kind="subtitles" label="Subtitles" srcLang="en-US" default />}
              </MediaOutlet>
              <MediaCommunitySkin />
            </MediaPlayer>
            {room.controlRequests?.length > 0 && isHost && <div className="requests">{room.controlRequests.map((request) => <button key={request.id} onClick={() => socket.emit('control:grant', { memberId: request.id })}>Grant {request.name}</button>)}</div>}
            {notice && <p className="notice" onAnimationEnd={() => setNotice('')}>{notice}</p>}
          </div>

          <aside className="chat card">
            <h2>Chat</h2>
            <div className="members">{room.members.map((member) => <span key={member.id}>{member.isHost ? '★ ' : ''}{member.name}</span>)}</div>
            <div className="messages">{messages.map((message) => <p key={message.id} className={message.type === 'system' ? 'system' : ''}><b>{message.type === 'system' ? '' : `${message.name}: `}</b>{message.text}</p>)}</div>
            <small>{typingLabel ? `${typingLabel} typing…` : ' '}</small>
            <form onSubmit={sendChat}><input value={chatText} onChange={(event) => updateTyping(event.target.value)} placeholder="Message room" /><button>Send</button></form>
          </aside>
        </section>
      )}
    </main>
  );
}

function appendUnique(messages, message) {
  if (!message || messages.some((existing) => existing.id === message.id)) return messages;
  return [...messages.slice(-79), message];
}

createRoot(document.getElementById('root')).render(<App />);
