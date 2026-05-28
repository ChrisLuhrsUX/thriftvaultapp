import AsyncStorage from '@react-native-async-storage/async-storage';

export const DAILY_SCAN_CAP = 100;

export class ScanCapError extends Error {
  constructor(message = "Daily scan limit reached. Resets at midnight.") {
    super(message);
    this.name = 'ScanCapError';
  }
}

function todayKey(): string {
  return `tv_scan_count_${new Date().toLocaleDateString('en-CA')}`;
}

export async function getTodayScanCount(): Promise<number> {
  const raw = await AsyncStorage.getItem(todayKey());
  const n = raw ? parseInt(raw, 10) : 0;
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export async function incrementTodayScanCount(): Promise<void> {
  const next = (await getTodayScanCount()) + 1;
  await AsyncStorage.setItem(todayKey(), String(next));
}

export async function checkScanCap(): Promise<void> {
  if ((await getTodayScanCount()) >= DAILY_SCAN_CAP) {
    throw new ScanCapError();
  }
}
