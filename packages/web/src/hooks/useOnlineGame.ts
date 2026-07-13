import { useCallback, useEffect, useRef, useState } from 'react';
import type { Card, PlayerView, Seat, Suit } from '@twenty-eight/engine';
import { getSocket } from '../net/socket';

export interface RoomSeatInfo {
  seat: Seat;
  name: string | null;
  isBot: boolean;
  connected: boolean;
}

export interface RoomState {
  roomCode: string;
  seats: RoomSeatInfo[];
  started: boolean;
}

type ConnectionStatus = 'connecting' | 'connected' | 'error';

export function useOnlineGame(name: string, roomCode: string) {
  const socketRef = useRef(getSocket());
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [seat, setSeat] = useState<Seat | null>(null);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [view, setView] = useState<PlayerView | null>(null);

  useEffect(() => {
    const socket = socketRef.current;

    function onConnect() {
      socket.emit('room:join', { roomCode, name });
    }
    function onJoined({ seat: s }: { roomCode: string; seat: Seat }) {
      setSeat(s);
      setStatus('connected');
      setError(null);
    }
    function onRoomState(s: RoomState) {
      setRoom(s);
    }
    function onView(v: PlayerView) {
      setView(v);
    }
    function onError({ message }: { message: string }) {
      setError(message);
      setStatus((prev) => (prev === 'connected' ? prev : 'error'));
    }
    function onDisconnect() {
      setStatus('error');
      setError('Disconnected from server.');
    }

    socket.on('connect', onConnect);
    socket.on('room:joined', onJoined);
    socket.on('room:state', onRoomState);
    socket.on('game:view', onView);
    socket.on('room:error', onError);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onDisconnect);

    if (socket.connected) {
      onConnect();
    } else {
      socket.connect();
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('room:joined', onJoined);
      socket.off('room:state', onRoomState);
      socket.off('game:view', onView);
      socket.off('room:error', onError);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onDisconnect);
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, name]);

  const startGame = useCallback((targetScore: number) => {
    socketRef.current.emit('room:start', { targetScore });
  }, []);

  const bid = useCallback((value: 'pass' | number) => {
    socketRef.current.emit('game:bid', { value });
  }, []);

  const pickTrump = useCallback((suit: Suit) => {
    socketRef.current.emit('game:trump', { suit });
  }, []);

  const callTrump = useCallback(() => {
    socketRef.current.emit('game:revealTrump', {});
  }, []);

  const play = useCallback((card: Card) => {
    socketRef.current.emit('game:play', { card });
  }, []);

  const nextRound = useCallback(() => {
    socketRef.current.emit('game:nextRound', {});
  }, []);

  return { status, error, seat, room, view, startGame, bid, pickTrump, callTrump, play, nextRound };
}
