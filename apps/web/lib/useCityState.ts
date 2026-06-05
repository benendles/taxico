"use client";

import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { API_URL } from "./api";
import type { CityState } from "./types";

export type ConnectionStatus = "connecting" | "live" | "offline";

/**
 * Subscribes to the live city snapshot over Socket.IO. Returns the latest state
 * and a connection status so the UI can show whether data is live or stale.
 */
export function useCityState() {
  const [state, setState] = useState<CityState | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(API_URL, { transports: ["websocket", "polling"] });
    socketRef.current = socket;

    socket.on("connect", () => setStatus("live"));
    socket.on("disconnect", () => setStatus("offline"));
    socket.on("connect_error", () => setStatus("offline"));
    socket.on("city:state", (next: CityState) => {
      setState(next);
      setStatus("live");
    });

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, []);

  return { state, status };
}
