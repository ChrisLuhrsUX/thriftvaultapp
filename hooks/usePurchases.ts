/**
 * RevenueCat purchases hook.
 *
 * Usage:
 *   const { isPro, isTrialing, subscribe, restorePurchases, loading } = usePurchases();
 *
 * Setup required before this works:
 *   1. npx expo install react-native-purchases (auto-linked; no app.json plugin needed)
 *   2. Set EXPO_PUBLIC_REVENUECAT_API_KEY in .env
 *   3. Build a dev client via EAS (Expo Go cannot bundle native modules)
 *   4. In App Store Connect: create products monthly, three_month, yearly
 *   5. In RevenueCat dashboard: entitlement "pro", offering "default" with those 3 packages
 *
 * State is held at module scope so every hook caller sees the same isPro / loading
 * snapshot. RC is configured exactly once; the customer-info listener fires updates
 * across every mounted component that's reading from this hook.
 */

import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';

const RC_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY ?? '';

export interface PurchasesState {
  isPro: boolean;
  loading: boolean;
  subscribe: (packageId: string) => Promise<{ success: boolean; error?: string }>;
  restorePurchases: () => Promise<{ success: boolean; error?: string }>;
}

// @ts-expect-error - module not installed until prebuild
let Purchases: typeof import('react-native-purchases').default | null = null;

async function getRC() {
  if (Purchases) return Purchases;
  try {
    // @ts-expect-error - module not installed until prebuild
    const mod = await import('react-native-purchases');
    Purchases = mod.default;
    return Purchases;
  } catch {
    return null;
  }
}

let _isPro = false;
let _loading = true;
let _initPromise: Promise<void> | null = null;
const _subscribers = new Set<() => void>();

function _emit() {
  _subscribers.forEach((fn) => fn());
}

function _setIsPro(v: boolean) {
  if (_isPro === v) return;
  _isPro = v;
  _emit();
}

function _setLoading(v: boolean) {
  if (_loading === v) return;
  _loading = v;
  _emit();
}

async function _init() {
  if (Platform.OS === 'web') {
    _setLoading(false);
    return;
  }

  const rc = await getRC();
  if (!rc) {
    _setIsPro(true);
    _setLoading(false);
    return;
  }

  if (!RC_API_KEY) {
    console.warn('[ThriftVault] EXPO_PUBLIC_REVENUECAT_API_KEY not set');
    _setIsPro(true);
    _setLoading(false);
    return;
  }

  try {
    rc.configure({ apiKey: RC_API_KEY });
    const info = await rc.getCustomerInfo();
    _setIsPro(!!info.entitlements.active['pro']);
    _setLoading(false);

    rc.addCustomerInfoUpdateListener(
      (info: { entitlements: { active: Record<string, unknown> } }) => {
        _setIsPro(!!info.entitlements.active['pro']);
      }
    );
  } catch (e) {
    console.error('[ThriftVault] RevenueCat init failed:', e);
    _setIsPro(false);
    _setLoading(false);
  }
}

function _ensureInit() {
  if (!_initPromise) _initPromise = _init();
  return _initPromise;
}

export function usePurchases(): PurchasesState {
  const [, force] = useState(0);

  useEffect(() => {
    const trigger = () => force((n) => n + 1);
    _subscribers.add(trigger);
    _ensureInit();
    return () => {
      _subscribers.delete(trigger);
    };
  }, []);

  const subscribe = useCallback(async (packageId: string) => {
    const rc = await getRC();
    if (!rc) return { success: false, error: 'Purchases SDK not available' };

    try {
      const offerings = await rc.getOfferings();
      const current = offerings.current;
      if (!current) return { success: false, error: 'No offerings available' };

      const pkg = current.availablePackages.find(
        (p: { identifier: string }) => p.identifier === packageId
      ) ?? current.availablePackages[0];
      if (!pkg) return { success: false, error: 'Plan not found' };

      const { customerInfo } = await rc.purchasePackage(pkg);
      _setIsPro(!!customerInfo.entitlements.active['pro']);
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
      _setIsPro(!!info.entitlements.active['pro']);
      return { success: true };
    } catch (e) {
      return { success: false, error: (e as Error)?.message ?? 'Restore failed' };
    }
  }, []);

  return { isPro: _isPro, loading: _loading, subscribe, restorePurchases };
}
