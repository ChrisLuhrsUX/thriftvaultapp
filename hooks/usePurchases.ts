/**
 * RevenueCat purchases hook.
 *
 * Usage:
 *   const { isPro, isTrialing, subscribe, restorePurchases, loading } = usePurchases();
 *
 * Setup required before this works:
 *   1. npm install react-native-purchases
 *   2. Add ["react-native-purchases", {}] to app.json plugins
 *   3. Run npx expo prebuild
 *   4. Set EXPO_PUBLIC_REVENUECAT_API_KEY in .env
 *   5. In App Store Connect: create products tv_monthly, tv_season, tv_annual
 *   6. In RevenueCat dashboard: entitlement "pro", offering "default" with those 3 products
 */

import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';

const RC_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY ?? '';

export interface PurchasesState {
  /** User has an active Pro entitlement (paid or trial via RevenueCat). */
  isPro: boolean;
  /** Still loading entitlement status — show nothing gated yet. */
  loading: boolean;
  /** Subscribe to a plan by RevenueCat package identifier. */
  subscribe: (packageId: string) => Promise<{ success: boolean; error?: string }>;
  /** Restore prior purchases (required by Apple). */
  restorePurchases: () => Promise<{ success: boolean; error?: string }>;
}

let Purchases: typeof import('react-native-purchases').default | null = null;

async function getRC() {
  if (Purchases) return Purchases;
  try {
    const mod = await import('react-native-purchases');
    Purchases = mod.default;
    return Purchases;
  } catch {
    // react-native-purchases not installed yet — return null (stub mode)
    return null;
  }
}

export function usePurchases(): PurchasesState {
  const [isPro, setIsPro] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (Platform.OS === 'web') {
        setLoading(false);
        return;
      }

      const rc = await getRC();
      if (!rc) {
        // SDK not installed yet — treat everyone as Pro during dev
        if (!cancelled) {
          setIsPro(true);
          setLoading(false);
        }
        return;
      }

      if (!RC_API_KEY) {
        console.warn('[ThriftVault] EXPO_PUBLIC_REVENUECAT_API_KEY not set');
        if (!cancelled) { setIsPro(true); setLoading(false); }
        return;
      }

      try {
        rc.configure({ apiKey: RC_API_KEY });
        const info = await rc.getCustomerInfo();
        if (!cancelled) {
          setIsPro(!!info.entitlements.active['pro']);
          setLoading(false);
        }

        rc.addCustomerInfoUpdateListener((info) => {
          if (!cancelled) setIsPro(!!info.entitlements.active['pro']);
        });
      } catch (e) {
        console.error('[ThriftVault] RevenueCat init failed:', e);
        if (!cancelled) { setIsPro(false); setLoading(false); }
      }
    }

    init();
    return () => { cancelled = true; };
  }, []);

  const subscribe = useCallback(async (packageId: string) => {
    const rc = await getRC();
    if (!rc) return { success: false, error: 'Purchases SDK not available' };

    try {
      const offerings = await rc.getOfferings();
      const current = offerings.current;
      if (!current) return { success: false, error: 'No offerings available' };

      const pkg = current.availablePackages.find((p) => p.identifier === packageId)
        ?? current.availablePackages[0];
      if (!pkg) return { success: false, error: 'Plan not found' };

      const { customerInfo } = await rc.purchasePackage(pkg);
      setIsPro(!!customerInfo.entitlements.active['pro']);
      return { success: true };
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code;
      if (code === 'PURCHASE_CANCELLED') return { success: false };
      return { success: false, error: (e as Error)?.message ?? 'Purchase failed' };
    }
  }, []);

  const restorePurchases = useCallback(async () => {
    const rc = await getRC();
    if (!rc) return { success: false, error: 'Purchases SDK not available' };

    try {
      const info = await rc.restorePurchases();
      const active = !!info.entitlements.active['pro'];
      setIsPro(active);
      return { success: true };
    } catch (e) {
      return { success: false, error: (e as Error)?.message ?? 'Restore failed' };
    }
  }, []);

  return { isPro, loading, subscribe, restorePurchases };
}
