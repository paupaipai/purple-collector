import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { PREMIUM_ENABLED } from './constants';
import {
  getCustomerInfo,
  hasPremiumEntitlement,
  initPurchases,
  isPurchasesConfigured,
  restorePurchases,
} from './purchases';

const premiumKey = (userId: string) => `@purplecollector/premium:${userId}`;

interface PremiumCtx {
  isPremium: boolean;
  unlock: () => Promise<void>;
  revoke: () => Promise<void>;
  restore: () => Promise<void>;
}

const PremiumContext = createContext<PremiumCtx>({
  isPremium: false,
  unlock: async () => {},
  revoke: async () => {},
  restore: async () => {},
});

export function PremiumProvider({
  children,
  userId,
}: {
  children: React.ReactNode;
  userId: string | null;
}) {
  const [isPremium, setIsPremium] = useState(!PREMIUM_ENABLED);

  useEffect(() => {
    if (!PREMIUM_ENABLED) {
      // v1 launch: everything unlocked, RevenueCat untouched until the flag flips back on.
      setIsPremium(true);
      return;
    }

    if (!userId) {
      setIsPremium(false);
      return;
    }

    (async () => {
      // RevenueCat is the source of truth once configured (see lib/purchases.ts).
      if (isPurchasesConfigured()) {
        await initPurchases(userId);
        const info = await getCustomerInfo();
        setIsPremium(hasPremiumEntitlement(info));
        return;
      }

      // Fallback while RevenueCat isn't set up yet: local mock flag (dev/testing only).
      const cached = await AsyncStorage.getItem(premiumKey(userId));
      setIsPremium(cached === 'true');
    })();
  }, [userId]);

  const unlock = async () => {
    if (!userId) return;
    // Real purchases are triggered from the paywall via purchasePackage().
    // This mock unlock is only used as a fallback when RevenueCat has no API key set.
    await AsyncStorage.setItem(premiumKey(userId), 'true');
    setIsPremium(true);
  };

  const revoke = async () => {
    if (!userId) return;
    await AsyncStorage.removeItem(premiumKey(userId));
    setIsPremium(false);
  };

  const restore = async () => {
    if (!userId || !isPurchasesConfigured()) return;
    const info = await restorePurchases();
    setIsPremium(hasPremiumEntitlement(info));
  };

  return (
    <PremiumContext.Provider value={{ isPremium, unlock, revoke, restore }}>
      {children}
    </PremiumContext.Provider>
  );
}

export function usePremium() {
  return useContext(PremiumContext);
}
