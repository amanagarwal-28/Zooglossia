import AsyncStorage from "@react-native-async-storage/async-storage";

export const REMINDER_KEY = "pet_reminder_settings";

export const DEFAULT_REMINDER_SETTINGS = {
    enabled: false,
    mealTime: "08:00",
    playTime: "18:00",
    hydrationTime: "12:00",
    lastShownDate: "",
};

export async function loadReminderSettings() {
    try {
        const raw = await AsyncStorage.getItem(REMINDER_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        return { ...DEFAULT_REMINDER_SETTINGS, ...(parsed || {}) };
    } catch (err) {
        console.warn("Failed to load reminder settings:", err);
        return { ...DEFAULT_REMINDER_SETTINGS };
    }
}

export async function saveReminderSettings(nextSettings) {
    try {
        const normalized = { ...DEFAULT_REMINDER_SETTINGS, ...(nextSettings || {}) };
        await AsyncStorage.setItem(REMINDER_KEY, JSON.stringify(normalized));
        return normalized;
    } catch (err) {
        console.warn("Failed to save reminder settings:", err);
        throw err;
    }
}

export function isTimeStringValid(value) {
    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(value)) {
        return false;
    }
    return true;
}

function toMinutes(hhmm) {
    const [hh, mm] = hhmm.split(":").map(Number);
    return hh * 60 + mm;
}

export function getDueReminderMessage(settings, now = new Date()) {
    if (!settings?.enabled) {
        return null;
    }

    const todayKey = now.toISOString().slice(0, 10);
    if (settings.lastShownDate === todayKey) {
        return null;
    }

    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const checkWindowMins = 45;
    const due = [];

    const candidates = [
        { label: "Meal check", time: settings.mealTime },
        { label: "Hydration check", time: settings.hydrationTime },
        { label: "Playtime check", time: settings.playTime },
    ];

    for (const item of candidates) {
        if (!isTimeStringValid(item.time)) {
            continue;
        }
        const t = toMinutes(item.time);
        if (currentMinutes >= t && currentMinutes - t <= checkWindowMins) {
            due.push(item.label);
        }
    }

    if (!due.length) {
        return null;
    }

    return {
        message: `Reminder: ${due.join(", ")}. Open Analyze and record your pet if needed.",
        todayKey,
    };
}
