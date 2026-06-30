import { useEffect, useRef, useCallback } from 'react';

const WS_BASE = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';
const MAX_RECONNECT_DELAY = 15000;
const BASE_RECONNECT_DELAY = 2000;


export default function useWebSocket(user) {
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);
  const activeRef = useRef(true);
  const attemptRef = useRef(0);

  const connect = useCallback(() => {
    if (!user) return;
    const token = localStorage.getItem('access');
    if (!token) {
      console.warn('[WS] No access token in localStorage — skipping connect');
      return;
    }

    const url = `${WS_BASE}/ws/updates/?token=${token}`;
    console.log('[WS] Connecting to', url.replace(token, token.slice(0, 12) + '…'));

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WS] Connected ✅');
      attemptRef.current = 0;
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
    };

    ws.onmessage = (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      const { type, data } = msg;

      if (type === 'shelf_shared') {
        ws.send(JSON.stringify({ type: 'refresh_shelves' }));
      }

      window.dispatchEvent(new CustomEvent(`ws:${type}`, { detail: data }));
    };

    ws.onerror = (err) => {
      console.error('[WS] Error', err);
    };

    ws.onclose = (e) => {
      console.warn(`[WS] Closed — code: ${e.code}, reason: "${e.reason || 'none'}"`);
      if (!activeRef.current) return;

      attemptRef.current += 1;
      const delay = Math.min(
        BASE_RECONNECT_DELAY * 2 ** (attemptRef.current - 1),
        MAX_RECONNECT_DELAY
      );
      console.log(`[WS] Reconnecting in ${delay / 1000}s (attempt ${attemptRef.current})`);

      reconnectTimer.current = setTimeout(() => {
        if (activeRef.current) connect();
      }, delay);
    };
  }, [user]);

  useEffect(() => {
    activeRef.current = true;
    attemptRef.current = 0;
    connect();

    return () => {
      activeRef.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connect]);

  return wsRef;
}