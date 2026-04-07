import React, { useState } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    ActivityIndicator,
    Alert,
} from "react-native";
import { useAuth } from "../context/AuthContext";

export function RegisterScreen({ navigation }) {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);

    const { register, error } = useAuth();

    async function handleRegister() {
        if (!name.trim() || !email.trim() || !password.trim()) {
            Alert.alert("Validation", "Name, email, and password required");
            return;
        }
        if (password !== confirmPassword) {
            Alert.alert("Validation", "Passwords do not match");
            return;
        }
        if (password.length < 8) {
            Alert.alert("Validation", "Password must be at least 8 characters");
            return;
        }

        setLoading(true);
        try {
            await register(email.toLowerCase().trim(), password, name.trim());
        } catch (err) {
            Alert.alert("Registration failed", err.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <SafeAreaView style={styles.safe}>
            <ScrollView contentContainerStyle={styles.container}>
                <Text style={styles.title}>Create Account</Text>
                <Text style={styles.subtitle}>Join Zooglossia</Text>

                <View style={styles.form}>
                    <View style={styles.field}>
                        <Text style={styles.label}>Name</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Your name"
                            value={name}
                            onChangeText={setName}
                            editable={!loading}
                            autoComplete="name"
                        />
                    </View>

                    <View style={styles.field}>
                        <Text style={styles.label}>Email</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="you@example.com"
                            value={email}
                            onChangeText={setEmail}
                            editable={!loading}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoComplete="email"
                        />
                    </View>

                    <View style={styles.field}>
                        <Text style={styles.label}>Password</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="••••••••"
                            value={password}
                            onChangeText={setPassword}
                            editable={!loading}
                            secureTextEntry
                            autoComplete="password-new"
                        />
                    </View>

                    <View style={styles.field}>
                        <Text style={styles.label}>Confirm Password</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="••••••••"
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            editable={!loading}
                            secureTextEntry
                        />
                    </View>

                    {error && <Text style={styles.error}>{error}</Text>}

                    <TouchableOpacity
                        style={[styles.signupBtn, loading && styles.disabled]}
                        onPress={handleRegister}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.signupBtnText}>Create Account</Text>
                        )}
                    </TouchableOpacity>
                </View>

                <View style={styles.footer}>
                    <Text style={styles.footerText}>Already have an account? </Text>
                    <TouchableOpacity onPress={() => navigation.navigate("Login")}>
                        <Text style={styles.link}>Sign in</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: "#fafafa" },
    container: { flexGrow: 1, justifyContent: "center", padding: 24, paddingBottom: 48 },
    title: { fontSize: 28, fontWeight: "700", color: "#1b5e20", textAlign: "center", marginBottom: 4 },
    subtitle: { fontSize: 15, color: "#666", textAlign: "center", marginBottom: 32 },
    form: { gap: 12, marginBottom: 24 },
    field: { marginBottom: 8 },
    label: { fontSize: 13, fontWeight: "600", color: "#333", marginBottom: 6 },
    input: {
        borderWidth: 1,
        borderColor: "#ddd",
        borderRadius: 10,
        padding: 12,
        fontSize: 15,
        color: "#222",
        backgroundColor: "#fff",
    },
    error: { color: "#c62828", fontSize: 13, marginTop: 8 },
    signupBtn: {
        backgroundColor: "#1b5e20",
        borderRadius: 10,
        padding: 14,
        alignItems: "center",
        marginTop: 8,
    },
    disabled: { opacity: 0.6 },
    signupBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
    footer: { flexDirection: "row", justifyContent: "center", gap: 4 },
    footerText: { color: "#666", fontSize: 14 },
    link: { color: "#1b5e20", fontWeight: "600", fontSize: 14 },
});
