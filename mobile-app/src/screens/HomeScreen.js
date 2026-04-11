import React, { useEffect } from "react";
import {
    View, Text, StyleSheet, ScrollView,
    ActivityIndicator, Alert, SafeAreaView, TouchableOpacity,
    FlatList, Modal
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { AudioRecorder } from "../components/AudioRecorder";
import { useAnalyze } from "../hooks/useAnalyze";
import { useAuth } from "../context/AuthContext";
import { usePets } from "../hooks/usePets";
import { getDueReminderMessage, loadReminderSettings, saveReminderSettings } from "../utils/reminders";

const SPECIES_EMOJI = { dog: "🐶", cat: "🐱", bird: "🐦", rabbit: "🐰" };

export function HomeScreen({ navigation }) {
    const { analyze, loading, error } = useAnalyze();
    const { logout, user } = useAuth();
    const { pets, selectedPet, setSelectedPet, refetch: refetchPets } = usePets();
    const [pickerVisible, setPickerVisible] = React.useState(false);

    useFocusEffect(
        React.useCallback(() => {
            let cancelled = false;
            refetchPets();

            (async () => {
                const settings = await loadReminderSettings();
                const due = getDueReminderMessage(settings);
                if (!due || cancelled) return;
                Alert.alert("Pet Reminder", due.message);
                await saveReminderSettings({ ...settings, lastShownDate: due.todayKey });
            })();

            return () => { cancelled = true; };
        }, [])
    );

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
            const result = await analyze(uri, {}, selectedPet);
            navigation.navigate("Results", { result, pet: selectedPet });
        } catch (err) {
            Alert.alert("Analysis failed", err?.message || "Unknown error");
        }
    }

    const petLabel = selectedPet
        ? `${SPECIES_EMOJI[selectedPet.species] || "🐾"} ${selectedPet.name}`
        : "Select a pet";

    return (
        <SafeAreaView style={styles.safe}>
            <ScrollView contentContainerStyle={styles.container}>
                <Text style={styles.title}>Zooglossia</Text>
                <Text style={styles.subtitle}>Understand what your pet is saying</Text>
                {user?.name && <Text style={styles.userText}>Hey, {user.name}!</Text>}

                {/* Pet selector */}
                <TouchableOpacity
                    style={[styles.petPill, !selectedPet && styles.petPillEmpty]}
                    onPress={() => setPickerVisible(true)}
                >
                    <Text style={[styles.petPillText, !selectedPet && styles.petPillTextEmpty]}>
                        {petLabel}
                    </Text>
                    <Text style={styles.petPillArrow}>▾</Text>
                </TouchableOpacity>

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
                    Select your pet, then record and tap stop to analyze.
                </Text>
            </ScrollView>

            {/* Pet picker modal */}
            <Modal visible={pickerVisible} transparent animationType="slide" onRequestClose={() => setPickerVisible(false)}>
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setPickerVisible(false)}>
                    <View style={styles.modalSheet}>
                        <Text style={styles.modalTitle}>Select Pet</Text>
                        {pets.length === 0 ? (
                            <Text style={styles.modalEmpty}>No pets added yet. Go to the Pets tab to add one.</Text>
                        ) : (
                            <FlatList
                                data={pets}
                                keyExtractor={(item) => item._id || item.id}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        style={[styles.modalItem, selectedPet?._id === item._id && styles.modalItemSelected]}
                                        onPress={() => { setSelectedPet(item); setPickerVisible(false); }}
                                    >
                                        <Text style={styles.modalItemText}>
                                            {SPECIES_EMOJI[item.species] || "🐾"} {item.name}
                                            {item.breed ? `  ·  ${item.breed}` : ""}
                                        </Text>
                                        {selectedPet?._id === item._id && <Text style={styles.checkmark}>✓</Text>}
                                    </TouchableOpacity>
                                )}
                            />
                        )}
                    </View>
                </TouchableOpacity>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: "#fafafa" },
    container: { flexGrow: 1, alignItems: "center", padding: 24, paddingTop: 48 },
    title: { fontSize: 32, fontWeight: "700", color: "#1b5e20", marginBottom: 6 },
    subtitle: { fontSize: 15, color: "#555", marginBottom: 12 },
    userText: { fontSize: 14, color: "#888", marginBottom: 12 },
    petPill: {
        flexDirection: "row", alignItems: "center", gap: 6,
        backgroundColor: "#e8f5e9", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8,
        borderWidth: 1, borderColor: "#a5d6a7", marginBottom: 8,
    },
    petPillEmpty: { backgroundColor: "#fff3e0", borderColor: "#ffcc80" },
    petPillText: { fontSize: 14, fontWeight: "600", color: "#1b5e20" },
    petPillTextEmpty: { color: "#e65100" },
    petPillArrow: { color: "#888", fontSize: 12 },
    recorderWrapper: { marginVertical: 32 },
    loadingRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 16 },
    loadingText: { color: "#555", fontSize: 14 },
    error: { color: "#c62828", marginTop: 12, textAlign: "center" },
    hint: { position: "absolute", bottom: 24, color: "#aaa", fontSize: 12, textAlign: "center", paddingHorizontal: 32 },
    logoutButton: { paddingVertical: 8, paddingHorizontal: 12 },
    logoutText: { color: "#1b5e20", fontSize: 14, fontWeight: "600" },
    modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.3)" },
    modalSheet: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: 400 },
    modalTitle: { fontSize: 18, fontWeight: "700", color: "#1b5e20", marginBottom: 12 },
    modalEmpty: { color: "#888", textAlign: "center", marginVertical: 14 },
    modalItem: { paddingVertical: 14, paddingHorizontal: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#eee", flexDirection: "row", justifyContent: "space-between" },
    modalItemSelected: { backgroundColor: "#f1f8f1" },
    modalItemText: { fontSize: 15, color: "#222" },
    checkmark: { color: "#2e7d32", fontWeight: "700" },
});
