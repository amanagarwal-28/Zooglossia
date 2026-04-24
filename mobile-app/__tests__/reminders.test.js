jest.mock("expo-notifications", () => ({
    getPermissionsAsync: jest.fn(async () => ({ granted: true })),
    requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
    scheduleNotificationAsync: jest.fn(async () => "mock-notification-id"),
    cancelScheduledNotificationAsync: jest.fn(async () => {}),
    SchedulableTriggerInputTypes: { DAILY: "daily" },
}));

jest.mock("react-native", () => ({
    Platform: { OS: "ios" },
}));

import { isTimeStringValid, getDueReminderMessage, DEFAULT_REMINDER_SETTINGS } from "../src/utils/reminders";

describe("isTimeStringValid", () => {
    it("accepts valid HH:MM strings", () => {
        expect(isTimeStringValid("00:00")).toBe(true);
        expect(isTimeStringValid("08:30")).toBe(true);
        expect(isTimeStringValid("23:59")).toBe(true);
    });

    it("rejects malformed strings", () => {
        expect(isTimeStringValid("8:30")).toBe(false);
        expect(isTimeStringValid("25:00")).toBe(false);
        expect(isTimeStringValid("")).toBe(false);
        expect(isTimeStringValid("ab:cd")).toBe(false);
        expect(isTimeStringValid("08:60")).toBe(false);
    });
});

describe("getDueReminderMessage", () => {
    const baseSettings = {
        ...DEFAULT_REMINDER_SETTINGS,
        enabled: true,
        mealTime: "08:00",
        hydrationTime: "12:00",
        playTime: "18:00",
        lastShownDate: "",
    };

    it("returns null when reminders disabled", () => {
        const settings = { ...baseSettings, enabled: false };
        expect(getDueReminderMessage(settings, new Date("2026-04-24T08:05:00"))).toBeNull();
    });

    it("returns null when already shown today", () => {
        const settings = { ...baseSettings, lastShownDate: "2026-04-24" };
        expect(getDueReminderMessage(settings, new Date("2026-04-24T08:05:00"))).toBeNull();
    });

    it("returns message when within 45-minute window of a reminder time", () => {
        // 08:10 — within 45 min of mealTime 08:00
        const now = new Date("2026-04-24T08:10:00");
        const result = getDueReminderMessage(baseSettings, now);
        expect(result).not.toBeNull();
        expect(result.message).toContain("Meal check");
        expect(result.todayKey).toBe("2026-04-24");
    });

    it("returns null when outside all reminder windows", () => {
        // 10:00 — 2h after meal, 2h before hydration
        const now = new Date("2026-04-24T10:00:00");
        expect(getDueReminderMessage(baseSettings, now)).toBeNull();
    });

    it("includes multiple reminders when several are due", () => {
        // Force a scenario: set all times to 10:00
        const settings = {
            ...baseSettings,
            mealTime: "10:00",
            hydrationTime: "10:00",
            playTime: "10:00",
        };
        const now = new Date("2026-04-24T10:00:00");
        const result = getDueReminderMessage(settings, now);
        expect(result.message).toContain("Meal check");
        expect(result.message).toContain("Hydration check");
        expect(result.message).toContain("Playtime check");
    });
});
