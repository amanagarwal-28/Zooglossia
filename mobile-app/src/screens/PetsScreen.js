import React, { useState, useEffect } from "react";
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    Modal, TextInput, Alert, SafeAreaView, ActivityIndicator
} from "react-native";
import { useAuth } from "../context/AuthContext";

const SPECIES_EMOJI = { dog: "🐶", cat: "🐱", bird: "🐦", rabbit: "🐰", default: "🐾" };
const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000";

export function PetsScreen({ navigation }) {
    const [pets, setPets] = useState([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({ name: "", species: "dog", breed: "", age_years: "" });
    const { logout, token } = useAuth();

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

    useEffect(() => {
        fetchPets();
    }, [token]);

    async function handleLogout() {
        try {
            await logout();
        } catch (err) {
            Alert.alert("Logout failed", err.message);
        }
    }

    async function fetchPets() {
        if (!token) return;

        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/pets`, {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || `Failed to load pets (${res.status})`);
            }

            const data = await res.json();
            setPets(Array.isArray(data) ? data : []);
        } catch (err) {
            Alert.alert("Failed to load pets", err.message);
        } finally {
            setLoading(false);
        }
    }

    async function addPet() {
        if (!form.name.trim()) {
            Alert.alert("Name required");
            return;
        }

        if (!token) {
            Alert.alert("Authentication error", "Missing auth token. Please log in again.");
            return;
        }

        setSaving(true);
        try {
            const payload = {
                name: form.name.trim(),
                species: form.species.toLowerCase().trim() || "dog",
                breed: form.breed.trim() || null,
                age_years: form.age_years ? parseFloat(form.age_years) : null,
            };

            console.log("[PetsScreen] Adding pet with payload:", payload);

            const res = await fetch(`${API_URL}/pets`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });

            console.log("[PetsScreen] Response status:", res.status);

            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                console.error("[PetsScreen] Error response:", body);
                throw new Error(body.error || `Failed to add pet (${res.status})`);
            }

            const createdPet = await res.json();
            console.log("[PetsScreen] Pet created successfully:", createdPet);

            setPets((prev) => [...prev, createdPet]);
            setForm({ name: "", species: "dog", breed: "", age_years: "" });
            setModalVisible(false);
            Alert.alert("Success", "Pet added successfully!");
        } catch (err) {
            console.error("[PetsScreen] Error adding pet:", err.message);
            Alert.alert("Failed to add pet", err.message);
        } finally {
            setSaving(false);
        }
    }

    function deletePet(id) {
        Alert.alert("Remove pet", "Are you sure?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Remove",
                style: "destructive",
                onPress: async () => {
                    try {
                        const res = await fetch(`${API_URL}/pets/${id}`, {
                            method: "DELETE",
                            headers: {
                                Authorization: `Bearer ${token}`,
                            },
                        });

                        if (!res.ok) {
                            const body = await res.json().catch(() => ({}));
                            throw new Error(body.error || `Failed to delete pet (${res.status})`);
                        }

                        setPets((prev) => prev.filter((pet) => (pet._id || pet.id) !== id));
                    } catch (err) {
                        Alert.alert("Failed to delete pet", err.message);
                    }
                },
            },
        ]);
    }

    const emoji = (species) => SPECIES_EMOJI[species] || SPECIES_EMOJI.default;

    return (
        <SafeAreaView style={styles.safe}>
            <View style={styles.header}>
                <Text style={styles.title}>My Pets</Text>
                <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
                    <Text style={styles.addBtnText}>+ Add</Text>
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.empty}>
                    <ActivityIndicator size="large" color="#1b5e20" />
                    <Text style={styles.emptyText}>Loading pets...</Text>
                </View>
            ) : pets.length === 0 ? (
                <View style={styles.empty}>
                    <Text style={styles.emptyEmoji}>🐾</Text>
                    <Text style={styles.emptyText}>No pets yet. Tap + Add to get started.</Text>
                </View>
            ) : (
                <FlatList
                    data={pets}
                    keyExtractor={(item) => String(item._id || item.id)}
                    contentContainerStyle={styles.list}
                    renderItem={({ item }) => (
                        <View style={styles.petCard}>
                            <Text style={styles.petEmoji}>{emoji(item.species)}</Text>
                            <View style={styles.petInfo}>
                                <Text style={styles.petName}>{item.name}</Text>
                                <Text style={styles.petMeta}>
                                    {[item.species, item.breed, item.age_years != null ? `${item.age_years}y` : null]
                                        .filter(Boolean).join(" · ")}
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => deletePet(item._id || item.id)}>
                                <Text style={styles.deleteBtn}>✕</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                />
            )}

            {/* Add pet modal */}
            <Modal visible={modalVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalBox}>
                        <Text style={styles.modalTitle}>Add Pet</Text>
                        {[
                            { key: "name", label: "Name *", placeholder: "Buddy" },
                            { key: "species", label: "Species", placeholder: "dog / cat / bird…" },
                            { key: "breed", label: "Breed (optional)", placeholder: "Labrador" },
                            { key: "age_years", label: "Age in years (optional)", placeholder: "3", keyboardType: "numeric" },
                        ].map(({ key, label, placeholder, keyboardType }) => (
                            <View key={key} style={styles.field}>
                                <Text style={styles.fieldLabel}>{label}</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder={placeholder}
                                    value={form[key]}
                                    onChangeText={(v) => setForm((f) => ({ ...f, [key]: v }))}
                                    keyboardType={keyboardType || "default"}
                                    autoCapitalize="none"
                                />
                            </View>
                        ))}
                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={styles.cancelBtn}
                                onPress={() => !saving && setModalVisible(false)}
                                activeOpacity={saving ? 1 : 0.7}
                            >
                                <Text style={styles.cancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.saveBtn, saving && styles.disabledBtn]}
                                onPress={() => !saving && addPet()}
                                activeOpacity={saving ? 1 : 0.7}
                            >
                                {saving ? (
                                    <ActivityIndicator color="#fff" size="small" />
                                ) : (
                                    <Text style={styles.saveBtnText}>Save</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: "#fafafa" },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, paddingTop: 48 },
    title: { fontSize: 28, fontWeight: "700", color: "#1b5e20" },
    addBtn: { backgroundColor: "#4caf50", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
    addBtnText: { color: "#fff", fontWeight: "600" },
    empty: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
    emptyEmoji: { fontSize: 56 },
    emptyText: { color: "#999", fontSize: 15 },
    list: { padding: 16, gap: 12 },
    petCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 12, padding: 16, elevation: 2, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
    petEmoji: { fontSize: 36, marginRight: 14 },
    petInfo: { flex: 1 },
    petName: { fontSize: 17, fontWeight: "600", color: "#222" },
    petMeta: { fontSize: 13, color: "#888", marginTop: 2, textTransform: "capitalize" },
    deleteBtn: { color: "#ccc", fontSize: 18, padding: 4 },
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
    modalBox: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
    modalTitle: { fontSize: 20, fontWeight: "700", color: "#1b5e20", marginBottom: 20 },
    field: { marginBottom: 14 },
    fieldLabel: { fontSize: 13, color: "#555", marginBottom: 4 },
    input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 8, padding: 10, fontSize: 15, color: "#222" },
    modalActions: { flexDirection: "row", gap: 12, marginTop: 8 },
    cancelBtn: { flex: 1, borderWidth: 1, borderColor: "#ddd", borderRadius: 10, padding: 14, alignItems: "center" },
    cancelBtnText: { color: "#555", fontWeight: "600" },
    saveBtn: { flex: 1, backgroundColor: "#1b5e20", borderRadius: 10, padding: 14, alignItems: "center" },
    disabledBtn: { opacity: 0.6 },
    saveBtnText: { color: "#fff", fontWeight: "600" },
    logoutButton: { paddingVertical: 8, paddingHorizontal: 12 },
    logoutText: { color: "#1b5e20", fontSize: 14, fontWeight: "600" },
});
