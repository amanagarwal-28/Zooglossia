import React, { useCallback, useEffect, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    TouchableOpacity,
    Alert,
    RefreshControl,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const HISTORY_KEY = "analysis_history";

function formatDate(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "Unknown date";
    return d.toLocaleString();
}

export function HistoryScreen() {
    const [history, setHistory] = useState([]);
    const [expandedId, setExpandedId] = useState(null);
    const [refreshing, setRefreshing] = useState(false);

    const loadHistory = useCallback(async () => {
        try {
            const raw = await AsyncStorage.getItem(HISTORY_KEY);
            const list = raw ? JSON.parse(raw) : [];
            setHistory(Array.isArray(list) ? list : []);
        } catch (err) {
            console.warn("Failed to load analysis history:", err);
            setHistory([]);
        }
    }, []);

    useEffect(() => {
        loadHistory();
    }, [loadHistory]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await loadHistory();
        setRefreshing(false);
    }, [loadHistory]);

    function handleClearHistory() {
        Alert.alert(
            "Clear analysis history?",
            "This will remove all saved analysis results from this device.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Clear",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await AsyncStorage.removeItem(HISTORY_KEY);
                            setHistory([]);
                            setExpandedId(null);
                        } catch (err) {
                            Alert.alert("Failed", "Could not clear history. Please try again.");
                        }
                    },
                },
            ]
        );
    }

    return (
        <SafeAreaView style={styles.safe}>
            <View style={styles.headerRow}>
                <Text style={styles.title}>Analysis History</Text>
                {!!history.length && (
                    <TouchableOpacity onPress={handleClearHistory} style={styles.clearBtn}>
                        <Text style={styles.clearBtnText}>Clear</Text>
                    </TouchableOpacity>
                )}
            </View>

            <ScrollView
                contentContainerStyle={styles.container}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                {!history.length ? (
                    <View style={styles.emptyWrap}>
                        <Text style={styles.emptyTitle}>No analyses yet</Text>
                        <Text style={styles.emptySub}>Record and analyze a pet vocalization to see it here.</Text>
                    </View>
                ) : (
                    history.map((entry) => {
                        const res = entry.result || {};
                        const confidence = Math.round((res.intent_confidence || 0) * 100);
                        const probs = Object.entries(res.intent_probs || {})
                            .sort(([, a], [, b]) => b - a)
                            .slice(0, 3);
                        const expanded = expandedId === entry.id;

                        return (
                            <TouchableOpacity
                                key={entry.id}
                                activeOpacity={0.85}
                                style={styles.card}
                                onPress={() => setExpandedId(expanded ? null : entry.id)}
                            >
                                <View style={styles.cardTop}>
                                    <Text style={styles.intent}>{res.intent_label || "Unknown intent"}</Text>
                                    <Text style={styles.confidence}>{confidence}%</Text>
                                </View>
                                {entry.petName && (
                                    <Text style={styles.petTag}>🐾 {entry.petName}</Text>
                                )}
                                <Text style={styles.date}>{formatDate(entry.createdAt)}</Text>

                                {expanded && (
                                    <View style={styles.details}>
                                        <Text style={styles.detailsTitle}>Top probabilities</Text>
                                        {probs.map(([label, prob]) => (
                                            <View key={`${entry.id}-${label}`} style={styles.probRow}>
                                                <Text style={styles.probLabel}>{label}</Text>
                                                <Text style={styles.probValue}>{Math.round(prob * 100)}%</Text>
                                            </View>
                                        ))}
                                        {!!res.audio_features?.duration_seconds && (
                                            <Text style={styles.meta}>Duration: {res.audio_features.duration_seconds.toFixed(1)}s</Text>
                                        )}
                                    </View>
                                )}
                            </TouchableOpacity>
                        );
                    })
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: "#fafafa" },
    headerRow: {
        paddingHorizontal: 18,
        paddingTop: 18,
        paddingBottom: 10,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    title: { fontSize: 24, fontWeight: "700", color: "#1b5e20" },
    clearBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: "#ffebee" },
    clearBtnText: { color: "#b71c1c", fontWeight: "600" },
    container: { padding: 16, paddingBottom: 40 },
    emptyWrap: {
        marginTop: 48,
        backgroundColor: "#fff",
        borderRadius: 14,
        padding: 22,
        borderWidth: 1,
        borderColor: "#eee",
        alignItems: "center",
    },
    emptyTitle: { fontSize: 18, fontWeight: "700", color: "#333", marginBottom: 6 },
    emptySub: { color: "#666", textAlign: "center", lineHeight: 20 },
    card: {
        backgroundColor: "#fff",
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: "#e8e8e8",
        marginBottom: 12,
    },
    cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    intent: { color: "#1b5e20", fontSize: 16, fontWeight: "700", flex: 1, paddingRight: 10, textTransform: "capitalize" },
    confidence: { color: "#2e7d32", fontSize: 15, fontWeight: "700" },
    petTag: { color: "#388e3c", fontSize: 12, marginTop: 2 },
    date: { color: "#777", marginTop: 4, fontSize: 12 },
    details: {
        marginTop: 12,
        borderTopWidth: 1,
        borderTopColor: "#efefef",
        paddingTop: 10,
    },
    detailsTitle: { fontSize: 13, fontWeight: "700", color: "#444", marginBottom: 8 },
    probRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
    probLabel: { color: "#555", flex: 1, paddingRight: 8, textTransform: "capitalize" },
    probValue: { color: "#333", fontWeight: "600" },
    meta: { marginTop: 6, color: "#666", fontSize: 12 },
});
