import { Platform } from 'react-native';
import Purchases, { CustomerInfo, PurchasesOffering } from 'react-native-purchases';

// TODO: replace with your real RevenueCat public API keys.
// RevenueCat dashboard → Project settings → API keys.
// These keys are safe to ship in the app (they're public, write-only for purchases).
const REVENUECAT_API_KEY_IOS = 'YOUR_REVENUECAT_IOS_API_KEY';
const REVENUECAT_API_KEY_ANDROID = 'YOUR_REVENUECAT_ANDROID_API_KEY';

// TODO: must match the entitlement identifier configured in RevenueCat
// (RevenueCat dashboard → Entitlements).
export const ENTITLEMENT_ID = 'premium';

let configured = false;

function isConfigured() {
  const key = Platform.OS === 'ios' ? REVENUECAT_API_KEY_IOS : REVENUECAT_API_KEY_ANDROID;
  return !key.startsWith('YOUR_REVENUECAT_');
}

export async function initPurchases(userId: string): Promise<void> {
  if (!isConfigured()) {
    console.warn('[Purchases] RevenueCat API key not set — skipping init. See lib/purchases.ts');
    return;
  }
  const apiKey = Platform.OS === 'ios' ? REVENUECAT_API_KEY_IOS : REVENUECAT_API_KEY_ANDROID;

  if (!configured) {
    Purchases.configure({ apiKey, appUserID: userId });
    configured = true;
  } else {
    await Purchases.logIn(userId);
  }
}

export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  if (!isConfigured()) return null;
  try {
    return await Purchases.getCustomerInfo();
  } catch (e) {
    console.error('[Purchases] getCustomerInfo failed:', e);
    return null;
  }
}

export function hasPremiumEntitlement(info: CustomerInfo | null): boolean {
  if (!info) return false;
  return typeof info.entitlements.active[ENTITLEMENT_ID] !== 'undefined';
}

export async function getOfferings(): Promise<PurchasesOffering | null> {
  if (!isConfigured()) return null;
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current;
  } catch (e) {
    console.error('[Purchases] getOfferings failed:', e);
    return null;
  }
}

export async function purchasePackage(pkg: Parameters<typeof Purchases.purchasePackage>[0]) {
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return customerInfo;
}

export async function restorePurchases(): Promise<CustomerInfo | null> {
  if (!isConfigured()) return null;
  return Purchases.restorePurchases();
}

export function isPurchasesConfigured(): boolean {
  return isConfigured();
}
