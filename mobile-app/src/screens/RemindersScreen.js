import React, { useEffect, useState } from "react";
import {
    Alert,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import {
    DEFAULT_REMINDER_SETTINGS,
    isTimeStringValid,
    loadReminderSettings,
    saveReminderSettings,
} from "../utils/reminders";

export function RemindersScreen() {
    const [settings, setSettings] = useState(DEFAULT_REMINDER_SETTINGS);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        (async () => {
            const loaded = await loadReminderSettings();
            setSettings(loaded);
        })();
    }, []);

    function updateField(key, value) {
        setSettings((prev) => ({ ...prev, [key]: value }));
    }

    function applyPreset(preset) {
        if (preset === "early") {
            setSettings((prev) => ({
                ...prev,
                mealTime: "07:30",
                hydrationTime: "11:30",
                playTime: "17:30",
            }));
            return;
        }
        if (preset === "balanced") {
            setSettings((prev) => ({
                ...prev,
                mealTime: "08:00",
                hydrationTime: "12:00",
                playTime: "18:00",
            }));
            return;
        }
        setSettings((prev) => ({
            ...prev,
            mealTime: "09:00",
            hydrationTime: "14:00",
            playTime: "20:00",
        }));
    }

    async function handleSave() {
        if (!isTimeStringValid(settings.mealTime) || !isTimeStringValid(settings.hydrationTime) || !isTimeStringValid(settings.playTime)) {
            Alert.alert("Invalid time", "Use 24-hour format HH:MM, for example 08:30.");
            return;
        }

        try {
            setSaving(true);
            await saveReminderSettings(settings);
            Alert.alert("Saved", "Reminder settings updated.");
        } catch (err) {
            Alert.alert("Failed", "Could not save reminder settings.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <SafeAreaView style={styles.safe}>
            <ScrollView contentContainerStyle={styles.container}>
                <Text style={styles.title}>Reminders</Text>
                <Text style={styles.subtitle}>Set daily pet care reminders. Times use 24-hour format (HH:MM).</Text>

                <View style={styles.card}>
                    <View style={styles.switchRow}>
                        <Text style={styles.label}>Enable reminders</Text>
                        <Switch
                            value={settings.enabled}
                            onValueChange={(value) => updateField("enabled", value)}
                            trackColor={{ false: "#d6d6d6", true: "#7dcf8b" }}
                            thumbColor={settings.enabled ? "#2e7d32" : "#f4f4f4"}
                        />
                    </View>
                </View>

                <View style={styles.card}>
                    <Text style={styles.section}>Daily schedule</Text>

                    <View style={styles.presetsRow}>
                        <TouchableOpacity style={styles.presetBtn} onPress={() => applyPreset("early")}>
                            <Text style={styles.presetText}>Early Day</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.presetBtn} onPress={() => applyPreset("balanced")}>
                            <Text style={styles.presetText}>Balanced</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.presetBtn} onPress={() => applyPreset("late")}>
                            <Text style={styles.presetText}>Late Day</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.inputRow}>
                        <Text style={styles.inputLabel}>Meal check</Text>
                        <TextInput
                            style={styles.input}
                            value={settings.mealTime}
                            onChangeText={(value) => updateField("mealTime", value)}
                            placeholder="08:00"
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                    </View>

                    <View style={styles.inputRow}>
                        <Text style={styles.inputLabel}>Hydration check</Text>
                        <TextInput
                            style={styles.input}
                            value={settings.hydrationTime}
                            onChangeText={(value) => updateField("hydrationTime", value)}
                            placeholder="12:00"
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                    </View>

                    <View style={styles.inputRow}>
                        <Text style={styles.inputLabel}>Playtime check</Text>
                        <TextInput
                            style={styles.input}
                            value={settings.playTime}
                            onChangeText={(value) => updateField("playTime", value)}
                            placeholder="18:00"
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                    </View>
                </View>

                <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={handleSave} disabled={saving}>
                    <Text style={styles.saveText}>{saving ? "Saving..." : "Save Reminder Settings"}</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: "#fafafa" },
    container: { padding: 18, paddingBottom: 40 },
    title: { fontSize: 28, fontWeight: "700", color: "#1b5e20", marginBottom: 8 },
    subtitle: { color: "#666", marginBottom: 14, lineHeight: 20 },
    card: {
        backgroundColor: "#fff",
        borderRadius: 14,
        padding: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: "#ececec",
    },
    switchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    label: { fontSize: 15, fontWeight: "600", color: "#333" },
    section: { fontSize: 16, fontWeight: "700", color: "#333", marginBottom: 12 },
    presetsRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
    presetBtn: {
        flex: 1,
        backgroundColor: "#eef7ef",
        borderRadius: 10,
        paddingVertical: 9,
        alignItems: "center",
        borderWidth: 1,
        borderColor: "#d4ecd8",
    },
    presetText: { color: "#1f6a2a", fontSize: 12, fontWeight: "700" },
    inputRow: { marginBottom: 10 },
    inputLabel: { color: "#666", marginBottom: 4, fontSize: 13 },
    input: {
        borderWidth: 1,
        borderColor: "#ddd",
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: "#fff",
        color: "#222",
    },
    saveBtn: {
        marginTop: 6,
        backgroundColor: "#1b5e20",
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: "center",
    },
    saveBtnDisabled: { opacity: 0.7 },
    saveText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
