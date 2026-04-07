import React from "react";
import { TouchableOpacity, View, Text, StyleSheet, ActivityIndicator } from "react-native";

export function AudioRecorder({ onRecordingComplete, disabled }) {
    const [phase, setPhase] = React.useState("idle"); // idle | recording | processing
    const recRef = React.useRef(null);

    async function handlePress() {
        if (phase === "idle") {
            const { Audio } = await import("expo-av");
            await Audio.requestPermissionsAsync();
            await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
            const { recording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );
            recRef.current = recording;
            setPhase("recording");
        } else if (phase === "recording") {
            setPhase("processing");
            await recRef.current.stopAndUnloadAsync();
            const uri = recRef.current.getURI();
            recRef.current = null;
            setPhase("idle");
            if (onRecordingComplete) onRecordingComplete(uri);
        }
    }

    const label = phase === "idle" ? "Hold to Record" : phase === "recording" ? "Tap to Stop" : "Processing…";
    const color = phase === "recording" ? "#e53935" : "#4caf50";

    return (
        <View style={styles.container}>
            <TouchableOpacity
                style={[styles.button, { backgroundColor: color }]}
                onPress={handlePress}
                disabled={disabled || phase === "processing"}
                activeOpacity={0.8}
            >
                {phase === "processing" ? (
                    <ActivityIndicator color="#fff" size="large" />
                ) : (
                    <Text style={styles.icon}>{phase === "recording" ? "⏹" : "🎙"}</Text>
                )}
            </TouchableOpacity>
            <Text style={styles.label}>{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { alignItems: "center", gap: 8 },
    button: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: "center",
        alignItems: "center",
        elevation: 4,
        shadowColor: "#000",
        shadowOpacity: 0.3,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
    },
    icon: { fontSize: 32 },
    label: { fontSize: 13, color: "#555" },
});
