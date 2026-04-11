import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000";

export function usePets() {
    const [pets, setPets] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedPet, setSelectedPet] = useState(null);

    const fetchPets = useCallback(async () => {
        try {
            const token = await AsyncStorage.getItem("auth_token");
            if (!token) return;

            setLoading(true);
            const res = await fetch(`${API_URL}/pets`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) return;
            const data = await res.json();
            const list = Array.isArray(data) ? data : [];
            setPets(list);

            // Auto-select first pet if none selected yet
            setSelectedPet((prev) => {
                if (prev) return prev;
                return list.length > 0 ? list[0] : null;
            });
        } catch (err) {
            console.warn("usePets: failed to fetch pets", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPets();
    }, [fetchPets]);

    return { pets, loading, selectedPet, setSelectedPet, refetch: fetchPets };
}
