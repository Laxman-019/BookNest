import { useEffect, useRef, useCallback } from 'react';

const WS_BASE = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';
const RECONNECT_DELAY = 3000;

/**
 * Connects to the authenticated WebSocket and dispatches custom DOM events
 * so any component can listen without prop drilling.
 *
 * Events dispatched on window:
 *   'ws:book_lent'       — { detail: { book, lender } }
 *   'ws:book_returned'   — { detail: { book_id, title } }
 *   'ws:shelf_updated'   — { detail: { shelf_id, shelf, action, book, by } }
 *   'ws:activity_created'— { detail: { id, action, description, created_at } }
 *   'ws:shelf_shared'    — { detail: { shelf_id, shelf_name, role, shared_by } }
 */
export default function useWebSocket(user) {
  const wsRef          = useRef(null);
  const reconnectTimer = useRef(null);
  const activeRef      = useRef(true);   // set false on unmount to stop reconnecting

  const connect = useCallback(() => {
    if (!user) return;
    const token = localStorage.getItem('access');
    if (!token) return;

    const ws = new WebSocket(`${WS_BASE}/ws/updates/?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      // Clear any pending reconnect timer
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
        // Re-subscribe to the new shelf group
        ws.send(JSON.stringify({ type: 'refresh_shelves' }));
      }

      window.dispatchEvent(new CustomEvent(`ws:${type}`, { detail: data }));
    };

    ws.onerror = () => {
      // onclose will fire after onerror, reconnect there
    };

    ws.onclose = () => {
      if (!activeRef.current) return;
      // Reconnect after a delay
      reconnectTimer.current = setTimeout(() => {
        if (activeRef.current) connect();
      }, RECONNECT_DELAY);
    };
  }, [user]);

  useEffect(() => {
    activeRef.current = true;
    connect();

    return () => {
      activeRef.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connect]);

  return wsRef;
}