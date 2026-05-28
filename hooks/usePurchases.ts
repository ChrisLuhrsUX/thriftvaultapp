/**
 * RevenueCat purchases hook.
 *
 * State is held at module scope so every hook caller sees the same isPro / entitlement
 * snapshot. RC is configured exactly once; the customer-info listener fires updates
 * across every mounted component that's reading from this hook.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';

const RC_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY ?? '';
const PRO_ENTITLEMENT_ID = 'ThriftVault Pro';
const CACHE_KEY = 'tv_is_pro';

export interface PurchasesState {
  isPro: boolean;
  loading: boolean;
  proExpirationDate: Date | null;
  proWillRenew: boolean;
  proProductId: string | null;
  proIsInTrial: boolean;
  subscribe: (
    packageId: string
  ) => Promise<{ success: boolean; error?: string; alreadyActive?: boolean }>;
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

interface EntitlementSnapshot {
  isActive: boolean;
  expirationDate: Date | null;
  willRenew: boolean;
  productIdentifier: string | null;
  isInTrial: boolean;
}

const EMPTY_ENTITLEMENT: EntitlementSnapshot = {
  isActive: false,
  expirationDate: null,
  willRenew: false,
  productIdentifier: null,
  isInTrial: false,
};

let _entitlement: EntitlementSnapshot = EMPTY_ENTITLEMENT;
let _loading = true;
let _initPromise: Promise<void> | null = null;
const _subscribers = new Set<() => void>();

function _emit() {
  _subscribers.forEach((fn) => fn());
}

function _serializeEntitlement(e: EntitlementSnapshot): string {
  return JSON.stringify({
    isActive: e.isActive,
    expirationDate: e.expirationDate ? e.expirationDate.toISOString() : null,
    willRenew: e.willRenew,
    productIdentifier: e.productIdentifier,
    isInTrial: e.isInTrial,
  });
}

function _deserializeEntitlement(raw: string): EntitlementSnapshot | null {
  try {
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return {
      isActive: !!data.isActive,
      expirationDate: data.expirationDate ? new Date(data.expirationDate) : null,
      willRenew: !!data.willRenew,
      productIdentifier: data.productIdentifier ?? null,
      isInTrial: !!data.isInTrial,
    };
  } catch {
    return null;
  }
}

function _setEntitlement(next: EntitlementSnapshot) {
  if (
    _entitlement.isActive === next.isActive &&
    _entitlement.willRenew === next.willRenew &&
    _entitlement.productIdentifier === next.productIdentifier &&
    _entitlement.isInTrial === next.isInTrial &&
    _entitlement.expirationDate?.getTime() === next.expirationDate?.getTime()
  ) {
    return;
  }
  _entitlement = next;
  AsyncStorage.setItem(CACHE_KEY, _serializeEntitlement(next)).catch(() => {});
  _emit();
}

function _setLoading(v: boolean) {
  if (_loading === v) return;
  _loading = v;
  _emit();
}

function _snapshotFromInfo(info: {
  entitlements: {
    active: Record<
      string,
      {
        isActive: boolean;
        willRenew: boolean;
        periodType: string;
        expirationDate: string | null;
        productIdentifier: string;
      } | undefined
    >;
  };
}): EntitlementSnapshot {
  const ent = info.entitlements.active[PRO_ENTITLEMENT_ID];
  if (!ent || !ent.isActive) return EMPTY_ENTITLEMENT;
  return {
    isActive: true,
    expirationDate: ent.expirationDate ? new Date(ent.expirationDate) : null,
    willRenew: !!ent.willRenew,
    productIdentifier: ent.productIdentifier ?? null,
    isInTrial: ent.periodType === 'TRIAL',
  };
}

async function _init() {
  if (Platform.OS === 'web') {
    _setLoading(false);
    return;
  }

  try {
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    if (cached) {
      const parsed = _deserializeEntitlement(cached);
      if (parsed) {
        _entitlement = parsed;
        _loading = false;
        _emit();
      }
    }
  } catch {}

  const rc = await getRC();
  if (!rc) {
    _setEntitlement({ ...EMPTY_ENTITLEMENT, isActive: true });
    _setLoading(false);
    return;
  }

  if (!RC_API_KEY) {
    console.warn('[ThriftVault] EXPO_PUBLIC_REVENUECAT_API_KEY not set');
    _setEntitlement({ ...EMPTY_ENTITLEMENT, isActive: true });
    _setLoading(false);
    return;
  }

  try {
    rc.configure({ apiKey: RC_API_KEY });
    const info = await rc.getCustomerInfo();
    _setEntitlement(_snapshotFromInfo(info));
    _setLoading(false);

    rc.addCustomerInfoUpdateListener((info: Parameters<typeof _snapshotFromInfo>[0]) => {
      _setEntitlement(_snapshotFromInfo(info));
    });
  } catch (e) {
    console.error('[ThriftVault] RevenueCat init failed:', e);
    _setEntitlement(EMPTY_ENTITLEMENT);
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

    const wasActiveBefore = _entitlement.isActive;

    try {
      const offerings = await rc.getOfferings();
      const current = offerings.current;
      if (!current) return { success: false, error: 'No offerings available' };

      const pkg =
        current.availablePackages.find(
          (p: { identifier: string }) => p.identifier === packageId
        ) ?? current.availablePackages[0];
      if (!pkg) return { success: false, error: 'Plan not found' };

      const { customerInfo } = await rc.purchasePackage(pkg);
      _setEntitlement(_snapshotFromInfo(customerInfo));
      return { success: true, alreadyActive: wasActiveBefore };
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
      _setEntitlement(_snapshotFromInfo(info));
      return { success: true };
    } catch (e) {
      return { success: false, error: (e as Error)?.message ?? 'Restore failed' };
    }
  }, []);

  return {
    isPro: _entitlement.isActive,
    loading: _loading,
    proExpirationDate: _entitlement.expirationDate,
    proWillRenew: _entitlement.willRenew,
    proProductId: _entitlement.productIdentifier,
    proIsInTrial: _entitlement.isInTrial,
    subscribe,
    restorePurchases,
  };
}
