import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { BiasKey } from './types';
import { supabase } from './supabase';

const biasesKey = (userId: string) => `@purplecollector/biases:${userId}`;

interface BiasContextValue {
  biases: BiasKey[];
  biasLoading: boolean;
  saveBiases: (biases: BiasKey[]) => Promise<{ error?: string }>;
}

const BiasContext = createContext<BiasContextValue>({
  biases: [],
  biasLoading: true,
  saveBiases: async () => ({}),
});

export function BiasProvider({
  children,
  userId,
}: {
  children: React.ReactNode;
  userId: string | null;
}) {
  const [biases, setBiases] = useState<BiasKey[]>([]);
  const [biasLoading, setBiasLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setBiases([]);
      setBiasLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setBiasLoading(true);

      // Serve from cache immediately
      try {
        const cached = await AsyncStorage.getItem(biasesKey(userId));
        if (cached && !cancelled) {
          setBiases(JSON.parse(cached));
          setBiasLoading(false);
        }
      } catch {}

      // Then sync from Supabase (source of truth)
      try {
        const { data } = await supabase
          .from('user_profiles')
          .select('biases')
          .eq('id', userId)
          .single();

        if (!cancelled) {
          const serverBiases = (data?.biases as BiasKey[]) ?? [];
          setBiases(serverBiases);
          await AsyncStorage.setItem(biasesKey(userId), JSON.stringify(serverBiases));
        }
      } catch {}

      if (!cancelled) setBiasLoading(false);
    };

    load();
    return () => { cancelled = true; };
  }, [userId]);

  const saveBiases = async (newBiases: BiasKey[]): Promise<{ error?: string }> => {
    setBiases(newBiases);
    if (!userId) return {};

    try {
      await AsyncStorage.setItem(biasesKey(userId), JSON.stringify(newBiases));
    } catch {}

    const { error } = await supabase.from('user_profiles').upsert(
      { id: userId, biases: newBiases, onboarding_completed: true },
      { onConflict: 'id' }
    );

    if (error) return { error: error.message };
    return {};
  };

  return (
    <BiasContext.Provider value={{ biases, biasLoading, saveBiases }}>
      {children}
    </BiasContext.Provider>
  );
}

export function useBias() {
  return useContext(BiasContext);
}
