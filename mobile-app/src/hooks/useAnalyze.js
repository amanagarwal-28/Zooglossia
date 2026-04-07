import { useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000";

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
            formData.append("audio", {
                uri: audioUri,
                type: "audio/wav",
                name: "recording.wav",
            });

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
                    "Content-Type": "multipart/form-data",
                },
                body: formData,
            });

            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || `Server error ${res.status}`);
            }

            const data = await res.json();
            setResult(data);
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
