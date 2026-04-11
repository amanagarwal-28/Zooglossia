import { useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000";
const HISTORY_KEY = "analysis_history";

export function useAnalyze() {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    const analyze = useCallback(async (audioUri, iotContext = {}) => {
        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const token = await _getToken();

            const formData = new FormData();
            // On web, audioUri is a blob: URL — must fetch it to get the actual Blob.
            // On native, use the RN object shorthand { uri, type, name }.
            if (typeof document !== "undefined" && audioUri.startsWith("blob:")) {
                const blobRes = await fetch(audioUri);
                const blob = await blobRes.blob();
                const file = new File([blob], "recording.wav", { type: "audio/wav" });
                formData.append("audio", file);
            } else {
                formData.append("audio", {
                    uri: audioUri,
                    type: "audio/wav",
                    name: "recording.wav",
                });
            }

            const defaults = {
                time_of_day: new Date().getHours() + new Date().getMinutes() / 60,
                last_meal_hours_ago: 4,
                motion_level: "medium",
                room_temp_c: 22,
                activity_level: "resting",
            };
            const ctx = { ...defaults, ...iotContext };
            for (const [k, v] of Object.entries(ctx)) {
                formData.append(k, String(v));
            }

            const res = await fetch(`${API_URL}/analyze`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                body: formData,
            });

            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                const msg = typeof body.error === "string" ? body.error : JSON.stringify(body.error);
                throw new Error(msg || `Server error ${res.status}`);
            }

            const data = await res.json();
            setResult(data);
            await _appendHistory(data);
            return data;
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    return { analyze, loading, result, error };
}

// Get token from AsyncStorage (set by AuthContext during login)
async function _getToken() {
    try {
        const token = await AsyncStorage.getItem("auth_token");
        return token || "";
    } catch (err) {
        console.warn("Failed to retrieve token from storage:", err);
        return "";
    }
}

async function _appendHistory(result) {
    try {
        const raw = await AsyncStorage.getItem(HISTORY_KEY);
        const list = raw ? JSON.parse(raw) : [];
        const entry = {
            id: `${Date.now()}-${Math.floor(Math.random() * 100000)}`,
            createdAt: new Date().toISOString(),
            result,
        };
        const next = [entry, ...list].slice(0, 50);
        await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch (err) {
        console.warn("Failed to save analysis history:", err);
    }
}
