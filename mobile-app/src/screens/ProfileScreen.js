import React from "react";
import { Alert, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../context/AuthContext";

const HISTORY_KEY = "analysis_history";

export function ProfileScreen() {
    const { user, token, logout } = useAuth();

    const shortToken = token ? `${token.slice(0, 12)}...${token.slice(-8)}` : "Not available";

    async function handleSignOut() {
        try {
            await logout();
        } catch (err) {
            Alert.alert("Sign out failed", err?.message || "Please try again.");
        }
    }

    function confirmSignOut() {
        Alert.alert("Sign out?", "You will need to login again.", [
            { text: "Cancel", style: "cancel" },
            { text: "Sign out", style: "destructive", onPress: handleSignOut },
        ]);
    }

    function confirmClearHistory() {
        Alert.alert("Clear analysis history?", "This deletes all saved analyses on this device.", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Clear",
                style: "destructive",
                onPress: async () => {
                    try {
                        await AsyncStorage.removeItem(HISTORY_KEY);
                        Alert.alert("Done", "Analysis history cleared.");
                    } catch (err) {
                        Alert.alert("Failed", "Could not clear history.");
                    }
                },
            },
        ]);
    }

    return (
        <SafeAreaView style={styles.safe}>
            <ScrollView contentContainerStyle={styles.container}>
                <Text style={styles.title}>Profile & Settings</Text>

                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Account</Text>
                    <View style={styles.row}>
                        <Text style={styles.label}>Name</Text>
                        <Text style={styles.value}>{user?.name || "Not set"}</Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.label}>Email</Text>
                        <Text style={styles.value}>{user?.email || "Not set"}</Text>
                    </View>
                </View>

                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Session</Text>
                    <View style={styles.row}>
                        <Text style={styles.label}>Status</Text>
                        <Text style={[styles.value, styles.online]}>Signed in</Text>
                    </View>
                    <View style={styles.rowStack}>
                        <Text style={styles.label}>JWT token</Text>
                        <Text style={styles.token}>{shortToken}</Text>
                    </View>
                </View>

                <View style={styles.actions}>
                    <TouchableOpacity style={styles.secondaryBtn} onPress={confirmClearHistory}>
                        <Text style={styles.secondaryBtnText}>Clear Analysis History</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.dangerBtn} onPress={confirmSignOut}>
                        <Text style={styles.dangerBtnText}>Sign Out</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: "#fafafa" },
    container: { padding: 18, paddingBottom: 40 },
    title: { fontSize: 28, fontWeight: "700", color: "#1b5e20", marginBottom: 16 },
    card: {
        backgroundColor: "#fff",
        borderRadius: 14,
        padding: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: "#ececec",
    },
    sectionTitle: { fontSize: 16, fontWeight: "700", color: "#333", marginBottom: 10 },
    row: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 8,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: "#e5e5e5",
    },
    rowStack: { paddingTop: 8 },
    label: { color: "#666", fontSize: 13 },
    value: { color: "#222", fontSize: 14, fontWeight: "600" },
    token: {
        marginTop: 6,
        color: "#444",
        fontSize: 12,
        backgroundColor: "#f3f3f3",
        borderRadius: 8,
        paddingVertical: 8,
        paddingHorizontal: 10,
    },
    online: { color: "#2e7d32" },
    actions: { marginTop: 8, gap: 10 },
    secondaryBtn: {
        backgroundColor: "#fffde7",
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: "center",
        borderWidth: 1,
        borderColor: "#f5e9ab",
    },
    secondaryBtnText: { color: "#7a5a00", fontWeight: "700" },
    dangerBtn: {
        backgroundColor: "#b71c1c",
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: "center",
    },
    dangerBtnText: { color: "#fff", fontWeight: "700" },
});
