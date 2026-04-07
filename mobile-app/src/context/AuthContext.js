import React, { createContext, useState, useCallback, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000";
    const FETCH_TIMEOUT_MS = 10000;

    const _fetchWithTimeout = async (url, options = {}, timeoutMs = FETCH_TIMEOUT_MS) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        try {
            return await fetch(url, { ...options, signal: controller.signal });
        } finally {
            clearTimeout(timeout);
        }
    };

    // On app start, check if token exists in storage
    useEffect(() => {
        _restoreToken();
    }, []);

    const _restoreToken = async () => {
        try {
            const savedToken = await AsyncStorage.getItem("auth_token");
            const savedUser = await AsyncStorage.getItem("auth_user");
            if (savedToken && savedUser) {
                setToken(savedToken);
                setUser(JSON.parse(savedUser));
            }
        } catch (err) {
            console.warn("[auth] restore failed", err);
        } finally {
            setLoading(false);
        }
    };

    const register = useCallback(async (email, password, name) => {
        setError(null);
        try {
            const res = await _fetchWithTimeout(`${API_URL}/auth/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password, name }),
            });

            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || "Registration failed");
            }

            // After register, try auto-login; if it fails, keep signup success message clear.
            try {
                const loginRes = await _fetchWithTimeout(`${API_URL}/auth/login`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, password }),
                });

                if (!loginRes.ok) {
                    throw new Error("Account created successfully. Please sign in.");
                }

                const loginData = await loginRes.json();
                await _setAuthState(loginData.token, { email, name: loginData.name });
            } catch (loginErr) {
                setError("Account created successfully. Please sign in.");
                throw new Error("Account created successfully. Please sign in.");
            }
        } catch (err) {
            const message = err?.name === "AbortError"
                ? "Request timed out. Please check API server and try again."
                : err.message;
            setError(message);
            throw new Error(message);
        }
    }, [API_URL]);

    const login = useCallback(async (email, password) => {
        setError(null);
        try {
            const res = await _fetchWithTimeout(`${API_URL}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });

            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || "Invalid credentials");
            }

            const data = await res.json();
            await _setAuthState(data.token, { email, name: data.name });
        } catch (err) {
            const message = err?.name === "AbortError"
                ? "Request timed out. Please check API server and try again."
                : err.message;
            setError(message);
            throw new Error(message);
        }
    }, [API_URL]);

    const logout = useCallback(async () => {
        setUser(null);
        setToken(null);
        setError(null);
        await AsyncStorage.multiRemove(["auth_token", "auth_user"]);
    }, []);

    const _setAuthState = async (newToken, userData) => {
        setToken(newToken);
        setUser(userData);
        try {
            await AsyncStorage.setItem("auth_token", newToken);
            await AsyncStorage.setItem("auth_user", JSON.stringify(userData));
        } catch (err) {
            console.warn("[auth] persistence failed", err);
        }
    };

    const value = {
        user,
        token,
        loading,
        error,
        register,
        login,
        logout,
        isSignedIn: !!token,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const ctx = React.useContext(AuthContext);
    if (!ctx) {
        throw new Error("useAuth must be used within AuthProvider");
    }
    return ctx;
}
