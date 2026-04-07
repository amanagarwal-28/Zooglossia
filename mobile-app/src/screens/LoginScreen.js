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

export function LoginScreen({ navigation }) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [uiMessage, setUiMessage] = useState("");

    const { login, error } = useAuth();

    async function handleLogin() {
        setUiMessage("");
        if (!email.trim() || !password.trim()) {
            setUiMessage("Email and password required");
            return;
        }

        setLoading(true);
        try {
            await login(email.toLowerCase().trim(), password);
        } catch (err) {
            setUiMessage(err.message || "Login failed");
        } finally {
            setLoading(false);
        }
    }

    return (
        <SafeAreaView style={styles.safe}>
            <ScrollView contentContainerStyle={styles.container}>
                <Text style={styles.title}>Zooglossia</Text>
                <Text style={styles.subtitle}>Understand your pet</Text>

                <View style={styles.form}>
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
                            autoComplete="password"
                        />
                    </View>

                    {(uiMessage || error) && <Text style={styles.error}>{uiMessage || error}</Text>}

                    <TouchableOpacity
                        style={[styles.loginBtn, loading && styles.disabled]}
                        onPress={handleLogin}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.loginBtnText}>Sign In</Text>
                        )}
                    </TouchableOpacity>
                </View>

                <View style={styles.footer}>
                    <Text style={styles.footerText}>Don't have an account? </Text>
                    <TouchableOpacity onPress={() => navigation.navigate("Register")}>
                        <Text style={styles.link}>Sign up</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: "#fafafa" },
    container: { flexGrow: 1, justifyContent: "center", padding: 24 },
    title: { fontSize: 32, fontWeight: "700", color: "#1b5e20", textAlign: "center", marginBottom: 4 },
    subtitle: { fontSize: 15, color: "#666", textAlign: "center", marginBottom: 48 },
    form: { gap: 16, marginBottom: 32 },
    field: { marginBottom: 12 },
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
    loginBtn: {
        backgroundColor: "#1b5e20",
        borderRadius: 10,
        padding: 14,
        alignItems: "center",
        marginTop: 8,
    },
    disabled: { opacity: 0.6 },
    loginBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
    footer: { flexDirection: "row", justifyContent: "center", gap: 4 },
    footerText: { color: "#666", fontSize: 14 },
    link: { color: "#1b5e20", fontWeight: "600", fontSize: 14 },
});
