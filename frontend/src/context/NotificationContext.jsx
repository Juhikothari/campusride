import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";
import * as api from "../services/api.js";
import { useAuth } from "./AuthContext.jsx";
import "./NotificationContext.css";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || (import.meta.env.DEV ? "http://localhost:5000" : "");

const NotificationContext = createContext({
  unreadCount: 0,
  refreshUnread: () => {},
});

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [toasts, setToasts] = useState([]);
  const prevUnreadRef = useRef(-1);
  const socketRef = useRef(null);

  const isRegularUser = user && user.role !== "admin" && user.role !== "superadmin";

  const pushToast = useCallback((title, body) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((t) => [...t, { id, title: title || "Notification", body: body || "" }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 8000);
  }, []);

  const dismissToast = (id) => setToasts((t) => t.filter((x) => x.id !== id));

  const refreshUnread = useCallback(async () => {
    try {
      const { count } = await api.getUnreadNotificationCount();
      setUnreadCount(count);
      return count;
    } catch {
      return 0;
    }
  }, []);

  // Socket: real-time (when online)
  useEffect(() => {
    if (!isRegularUser || !SOCKET_URL) return;
    const token = api.getToken();
    if (!token) return;

    const socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      auth: { token },
    });
    socketRef.current = socket;

    socket.on("app-notification", (data) => {
      const title = data?.title || "CampusRide";
      const body = data?.body || "";
      pushToast(title, body);
      refreshUnread();
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isRegularUser, pushToast, refreshUnread]);

  // Poll: catch notifications when socket missed
  useEffect(() => {
    if (!isRegularUser) {
      setUnreadCount(0);
      prevUnreadRef.current = -1;
      return;
    }

    let cancelled = false;

    const tick = async () => {
      try {
        const { count } = await api.getUnreadNotificationCount();
        if (cancelled) return;
        if (prevUnreadRef.current >= 0 && count > prevUnreadRef.current) {
          const list = await api.getNotifications();
          const newest = list?.[0];
          if (newest) pushToast(newest.title, newest.body);
        }
        prevUnreadRef.current = count;
        setUnreadCount(count);
      } catch {
        /* ignore */
      }
    };

    tick();
    const id = setInterval(tick, 40000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [isRegularUser, pushToast]);

  return (
    <NotificationContext.Provider value={{ unreadCount, refreshUnread }}>
      {children}
      {toasts.length > 0 && (
        <div className="cr-toast-stack" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className="cr-toast" role="status">
              <button type="button" className="cr-toast-close" onClick={() => dismissToast(t.id)} aria-label="Dismiss">
                ×
              </button>
              <div className="cr-toast-title">{t.title}</div>
              {t.body ? <div className="cr-toast-body">{t.body}</div> : null}
            </div>
          ))}
        </div>
      )}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationContext);
