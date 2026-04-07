import { useState, useRef, useCallback } from "react";
import { Audio } from "expo-av";

export function useAudioRecorder() {
    const [recording, setRecording] = useState(null);
    const [audioUri, setAudioUri] = useState(null);
    const [isRecording, setIsRecording] = useState(false);
    const [durationMs, setDurationMs] = useState(0);

    const intervalRef = useRef(null);

    const startRecording = useCallback(async () => {
        try {
            await Audio.requestPermissionsAsync();
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            const { recording: rec } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );

            setRecording(rec);
            setIsRecording(true);
            setDurationMs(0);
            setAudioUri(null);

            intervalRef.current = setInterval(() => {
                setDurationMs((ms) => ms + 100);
            }, 100);
        } catch (err) {
            console.error("Failed to start recording", err);
            throw err;
        }
    }, []);

    const stopRecording = useCallback(async () => {
        if (!recording) return null;
        try {
            clearInterval(intervalRef.current);
            await recording.stopAndUnloadAsync();
            await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

            const uri = recording.getURI();
            setAudioUri(uri);
            setIsRecording(false);
            setRecording(null);
            return uri;
        } catch (err) {
            console.error("Failed to stop recording", err);
            throw err;
        }
    }, [recording]);

    return { startRecording, stopRecording, isRecording, audioUri, durationMs };
}
