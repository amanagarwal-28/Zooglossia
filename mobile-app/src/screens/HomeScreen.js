import React, { useEffect } from "react";
import {
    View, Text, StyleSheet, ScrollView,
    ActivityIndicator, Alert, SafeAreaView, TouchableOpacity
} from "react-native";
import { AudioRecorder } from "../components/AudioRecorder";
import { useAnalyze } from "../hooks/useAnalyze";
import { useAuth } from "../context/AuthContext";

export function HomeScreen({ navigation }) {
    const { analyze, loading, error } = useAnalyze();
    const { logout, user } = useAuth();

    useEffect(() => {
        navigation.setOptions({
            headerRight: () => (
                <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
                    <Text style={styles.logoutText}>Logout</Text>
                </TouchableOpacity>
            ),
            headerRightContainerStyle: { paddingRight: 16 },
        });
    }, [navigation]);

    async function handleLogout() {
        try {
            await logout();
        } catch (err) {
            Alert.alert("Logout failed", err.message);
        }
    }

    async function handleRecordingComplete(uri) {
        try {
            const result = await analyze(uri);
            navigation.navigate("Results", { result });
        } catch (err) {
            Alert.alert("Analysis failed", err?.message || "Unknown error");
        }
    }

    return (
        <SafeAreaView style={styles.safe}>
            <ScrollView contentContainerStyle={styles.container}>
                <Text style={styles.title}>Zooglossia</Text>
                <Text style={styles.subtitle}>Understand what your pet is saying</Text>
                {user?.name && <Text style={styles.userText}>Hey, {user.name}!</Text>}

                <View style={styles.recorderWrapper}>
                    <AudioRecorder
                        onRecordingComplete={handleRecordingComplete}
                        disabled={loading}
                    />
                </View>

                {loading && (
                    <View style={styles.loadingRow}>
                        <ActivityIndicator color="#4caf50" />
                        <Text style={styles.loadingText}>Analyzing vocalization…</Text>
                    </View>
                )}

                {error && <Text style={styles.error}>{error}</Text>}

                <Text style={styles.hint}>
                    Record your pet's sound and tap stop to analyze its intent.
                </Text>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: "#fafafa" },
    container: { flexGrow: 1, alignItems: "center", padding: 24, paddingTop: 48 },
    title: { fontSize: 32, fontWeight: "700", color: "#1b5e20", marginBottom: 6 },
    subtitle: { fontSize: 15, color: "#555", marginBottom: 12 },
    userText: { fontSize: 14, color: "#888", marginBottom: 36 },
    recorderWrapper: { marginVertical: 32 },
    loadingRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 16 },
    loadingText: { color: "#555", fontSize: 14 },
    error: { color: "#c62828", marginTop: 12, textAlign: "center" },
    hint: { position: "absolute", bottom: 24, color: "#aaa", fontSize: 12, textAlign: "center", paddingHorizontal: 32 },
    logoutButton: { paddingVertical: 8, paddingHorizontal: 12 },
    logoutText: { color: "#1b5e20", fontSize: 14, fontWeight: "600" },
});
