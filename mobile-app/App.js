import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Text, ActivityIndicator, View } from "react-native";

import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { LoginScreen } from "./src/screens/LoginScreen";
import { RegisterScreen } from "./src/screens/RegisterScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { ResultsScreen } from "./src/screens/ResultsScreen";
import { PetsScreen } from "./src/screens/PetsScreen";
import { HistoryScreen } from "./src/screens/HistoryScreen";
import { ProfileScreen } from "./src/screens/ProfileScreen";

const Tab = createBottomTabNavigator();
const AuthStack = createNativeStackNavigator();
const HomeStack = createNativeStackNavigator();
const PetsStack = createNativeStackNavigator();

function AuthStackNavigator() {
    return (
        <AuthStack.Navigator screenOptions={{ headerShown: false }}>
            <AuthStack.Screen name="Login" component={LoginScreen} />
            <AuthStack.Screen name="Register" component={RegisterScreen} />
        </AuthStack.Navigator>
    );
}

function HomeStackNavigator() {
    return (
        <HomeStack.Navigator screenOptions={{ headerShown: false }}>
            <HomeStack.Screen name="Home" component={HomeScreen} />
            <HomeStack.Screen name="Results" component={ResultsScreen} />
        </HomeStack.Navigator>
    );
}

function PetsStackNavigator() {
    return (
        <PetsStack.Navigator screenOptions={{ headerShown: false }}>
            <PetsStack.Screen name="PetsList" component={PetsScreen} />
        </PetsStack.Navigator>
    );
}

function AppNavigator() {
    return (
        <Tab.Navigator
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: "#1b5e20",
                tabBarInactiveTintColor: "#aaa",
                tabBarStyle: { borderTopWidth: 0, elevation: 8 },
            }}
        >
            <Tab.Screen
                name="Analyze"
                component={HomeStackNavigator}
                options={{ tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🎙</Text> }}
            />
            <Tab.Screen
                name="Pets"
                component={PetsStackNavigator}
                options={{ tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🐾</Text> }}
            />
            <Tab.Screen
                name="History"
                component={HistoryScreen}
                options={{ tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🕒</Text> }}
            />
            <Tab.Screen
                name="Profile"
                component={ProfileScreen}
                options={{ tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>⚙️</Text> }}
            />
        </Tab.Navigator>
    );
}

function RootNavigator() {
    const { isSignedIn, loading } = useAuth();

    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                <ActivityIndicator size="large" color="#1b5e20" />
            </View>
        );
    }

    return (
        <NavigationContainer>
            {isSignedIn ? <AppNavigator /> : <AuthStackNavigator />}
        </NavigationContainer>
    );
}

export default function App() {
    return (
        <AuthProvider>
            <RootNavigator />
        </AuthProvider>
    );
}
