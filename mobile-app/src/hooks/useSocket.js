import { useEffect, useRef, useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { io } from "socket.io-client";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000";

/**
 * Maintains a Socket.IO connection to the API server authenticated with the
 * stored JWT.  Automatically reconnects if the token changes.
 *
 * Returns:
 *   connected  – boolean, true when socket is live
 *   subscribe  – (event, callback) => unsubscribe function
 */
export function useSocket() {
    const socketRef = useRef(null);
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        let active = true;

        async function connect() {
            let token = "";
            try {
                token = (await AsyncStorage.getItem("auth_token")) || "";
            } catch (_) { }

            if (!active) return;

            const socket = io(API_URL, {
                auth: { token },
                transports: ["websocket"],
                reconnection: true,
                reconnectionDelay: 2000,
                reconnectionAttempts: 10,
            });

            socketRef.current = socket;

            socket.on("connect", () => {
                if (active) setConnected(true);
            });

            socket.on("disconnect", () => {
                if (active) setConnected(false);
            });

            socket.on("connect_error", (err) => {
                console.warn("[ws] connection error:", err.message);
                if (active) setConnected(false);
            });
        }

        connect();

        return () => {
            active = false;
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
            setConnected(false);
        };
    }, []);

    const subscribe = useCallback((event, callback) => {
        const socket = socketRef.current;
        if (socket) {
            socket.on(event, callback);
        }
        return () => {
            if (socketRef.current) {
                socketRef.current.off(event, callback);
            }
        };
    }, []);

    return { connected, subscribe };
}
