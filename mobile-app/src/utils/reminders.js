import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

export const REMINDER_KEY = "pet_reminder_settings";
const REMINDER_NOTIFICATION_IDS_KEY = "pet_reminder_notification_ids";

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

function parseTime(value) {
    const [hour, minute] = value.split(":").map(Number);
    return { hour, minute };
}

async function requestNotificationPermissions() {
    const existing = await Notifications.getPermissionsAsync();
    if (existing.granted) {
        return true;
    }
    const asked = await Notifications.requestPermissionsAsync();
    return !!asked.granted;
}

async function clearScheduledReminderNotifications() {
    try {
        const raw = await AsyncStorage.getItem(REMINDER_NOTIFICATION_IDS_KEY);
        const ids = raw ? JSON.parse(raw) : [];
        if (Array.isArray(ids)) {
            for (const id of ids) {
                try {
                    await Notifications.cancelScheduledNotificationAsync(id);
                } catch {
                    // Ignore stale ids that may already be removed.
                }
            }
        }
        await AsyncStorage.removeItem(REMINDER_NOTIFICATION_IDS_KEY);
    } catch (err) {
        console.warn("Failed clearing scheduled reminder notifications:", err);
    }
}

export async function configureReminderNotifications(settings) {
    if (Platform.OS === "web") {
        return { supported: false, scheduled: 0 };
    }

    await clearScheduledReminderNotifications();

    if (!settings?.enabled) {
        return { supported: true, scheduled: 0 };
    }

    const granted = await requestNotificationPermissions();
    if (!granted) {
        throw new Error("Notification permission was not granted.");
    }

    const schedules = [
        { title: "Meal check", body: "Time to check if your pet needs food.", time: settings.mealTime },
        { title: "Hydration check", body: "Check your pet's water bowl and hydration.", time: settings.hydrationTime },
        { title: "Playtime check", body: "Give your pet some playtime and interaction.", time: settings.playTime },
    ];

    const ids = [];
    for (const item of schedules) {
        if (!isTimeStringValid(item.time)) {
            continue;
        }
        const { hour, minute } = parseTime(item.time);
        const id = await Notifications.scheduleNotificationAsync({
            content: {
                title: `Zooglossia: ${item.title}`,
                body: item.body,
                sound: true,
            },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DAILY,
                hour,
                minute,
            },
        });
        ids.push(id);
    }

    await AsyncStorage.setItem(REMINDER_NOTIFICATION_IDS_KEY, JSON.stringify(ids));
    return { supported: true, scheduled: ids.length };
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
