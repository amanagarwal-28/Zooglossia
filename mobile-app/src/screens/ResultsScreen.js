import React, { useEffect } from "react";
import {
    View, Text, StyleSheet, ScrollView,
    TouchableOpacity, SafeAreaView, Alert
} from "react-native";
import { useAuth } from "../context/AuthContext";

const INTENT_EMOJI = {
    "hunger or food request": "🍖",
    "play or excitement": "🎾",
    "fear or anxiety": "😨",
    "pain or discomfort": "😣",
    "attention seeking": "🐾",
    "greeting or affection": "❤️",
    "territorial or aggression": "⚠️",
    "contentment or relaxation": "😌",
};

export function ResultsScreen({ route, navigation }) {
    const { result } = route.params;
    const { logout } = useAuth();
    const emoji = INTENT_EMOJI[result.intent_label] || "❓";
    const pct = Math.round(result.intent_confidence * 100);

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

    const sortedProbs = Object.entries(result.intent_probs).sort(([, a], [, b]) => b - a);

    return (
        <SafeAreaView style={styles.safe}>
            <ScrollView contentContainerStyle={styles.container}>
                {/* Main result card */}
                <View style={styles.card}>
                    <Text style={styles.emoji}>{emoji}</Text>
                    <Text style={styles.intentLabel}>{result.intent_label}</Text>
                    <Text style={styles.confidence}>{pct}% confidence</Text>
                </View>

                {/* Audio info */}
                <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Duration</Text>
                    <Text style={styles.infoValue}>{result.audio_features.duration_seconds.toFixed(1)}s</Text>
                </View>
                <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>NatureLM signal</Text>
                    <Text style={styles.infoValue}>{result.naturelm_intent}</Text>
                </View>
                <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Fused embedding</Text>
                    <Text style={styles.infoValue}>{result.fused_embedding_shape[0]}-dim</Text>
                </View>

                {/* Probability bars */}
                <Text style={styles.sectionTitle}>All intents</Text>
                {sortedProbs.map(([label, prob]) => (
                    <View key={label} style={styles.barRow}>
                        <Text style={styles.barLabel}>{INTENT_EMOJI[label]} {label}</Text>
                        <View style={styles.barTrack}>
                            <View style={[styles.barFill, { width: `${Math.round(prob * 100)}%` }]} />
                        </View>
                        <Text style={styles.barPct}>{Math.round(prob * 100)}%</Text>
                    </View>
                ))}

                <TouchableOpacity style={styles.btn} onPress={() => navigation.navigate("Home")}>
                    <Text style={styles.btnText}>Record Again</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: "#fafafa" },
    container: { padding: 24, paddingBottom: 48 },
    card: { backgroundColor: "#e8f5e9", borderRadius: 16, padding: 24, alignItems: "center", marginBottom: 24 },
    emoji: { fontSize: 56, marginBottom: 8 },
    intentLabel: { fontSize: 22, fontWeight: "700", color: "#1b5e20", textTransform: "capitalize", textAlign: "center" },
    confidence: { fontSize: 16, color: "#388e3c", marginTop: 4 },
    infoRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#ddd" },
    infoLabel: { color: "#777", fontSize: 13 },
    infoValue: { color: "#333", fontSize: 13, fontWeight: "500" },
    sectionTitle: { fontSize: 15, fontWeight: "600", color: "#333", marginTop: 20, marginBottom: 12 },
    barRow: { marginBottom: 10 },
    barLabel: { fontSize: 12, color: "#555", marginBottom: 3 },
    barTrack: { height: 8, backgroundColor: "#e0e0e0", borderRadius: 4, overflow: "hidden" },
    barFill: { height: 8, backgroundColor: "#4caf50", borderRadius: 4 },
    barPct: { fontSize: 11, color: "#888", marginTop: 2, textAlign: "right" },
    btn: { marginTop: 32, backgroundColor: "#1b5e20", borderRadius: 12, padding: 16, alignItems: "center" },
    btnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
    logoutButton: { paddingVertical: 8, paddingHorizontal: 12 },
    logoutText: { color: "#1b5e20", fontSize: 14, fontWeight: "600" },
});
