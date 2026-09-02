import { useCallback, useEffect, useRef, useState } from 'react';
import type { Card, PlayerView, Seat } from '@twenty-eight/engine';
import { getSocket } from '../net/socket';
import { getPlayerId } from '../utils/identity';

export interface RoomSeatInfo {
  seat: Seat;
  name: string | null;
  isBot: boolean;
  connected: boolean;
  ready: boolean;
}

export interface RoomState {
  roomCode: string;
  seats: RoomSeatInfo[];
  started: boolean;
}

// connecting: first contact, not yet seated. reconnecting: we had a seat and
// the socket dropped; socket.io is retrying and the seat is reclaimed on the
// next successful join. error: the room refused us.
export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'error';

export function useOnlineGame(name: string, roomCode: string) {
  const socketRef = useRef(getSocket());
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [seat, setSeat] = useState<Seat | null>(null);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [view, setView] = useState<PlayerView | null>(null);
  const hadSeat = useRef(false);

  useEffect(() => {
    const socket = socketRef.current;
    const playerId = getPlayerId();

    function onConnect() {
      socket.emit('room:join', { roomCode, name, playerId });
    }
    function onJoined({ seat: s }: { roomCode: string; seat: Seat }) {
      hadSeat.current = true;
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
      // A seat we already held survives on the server; keep the table up and
      // show that we are reconnecting rather than throwing the player out.
      if (hadSeat.current) {
        setStatus('reconnecting');
      } else {
        setStatus('connecting');
      }
    }
    function onConnectError(err: Error) {
      // While the socket keeps retrying, stay in connecting/reconnecting; the
      // UI turns a long wait into a "server waking up" hint.
      setError(err.message);
    }

    socket.on('connect', onConnect);
    socket.on('room:joined', onJoined);
    socket.on('room:state', onRoomState);
    socket.on('game:view', onView);
    socket.on('room:error', onError);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);

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
      socket.off('connect_error', onConnectError);
      socket.emit('room:leave', {});
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, name]);

  const startGame = useCallback((baseCards: number) => {
    socketRef.current.emit('room:start', { baseCards });
  }, []);

  const setReady = useCallback((ready: boolean) => {
    socketRef.current.emit('room:ready', { ready });
  }, []);

  const bid = useCallback((value: 'pass' | number) => {
    socketRef.current.emit('game:bid', { value });
  }, []);

  const redeal = useCallback(() => {
    socketRef.current.emit('game:redeal', {});
  }, []);

  const pickTrump = useCallback((card: Card) => {
    socketRef.current.emit('game:trump', { card });
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

  return {
    status,
    error,
    seat,
    room,
    view,
    startGame,
    setReady,
    bid,
    redeal,
    pickTrump,
    callTrump,
    play,
    nextRound,
  };
}
