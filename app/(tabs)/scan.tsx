import { AppIcon } from '@/components/AppIcon';
import { DEFAULT_ITEM_PLACEHOLDER_IMAGE } from '@/constants/seedItems';
import { useInventory } from '@/context/InventoryContext';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { useResponsive } from '@/hooks/useResponsive';
import { scanWithGemini } from '@/services/gemini';
import type { Theme } from '@/theme';
import type { Item, ItemScanSnapshot, ScanScenario } from '@/types/inventory';
import { getAuthenticityPresentation, getConfidencePresentation } from '@/utils/confidencePresentation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  ImageBackground,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SAVED_LATER_KEY = 'tv_saved_later';
type SavedScanItem = ScanScenario & { savedAt: number; photoUri?: string | null };
const SNAPSHOT_CAP = 5;
const OLD_ITEM_DAYS_THRESHOLD = 90;

const RECENTS_COUNT = 7;

const SCAN_BG_SOURCE = require('@/assets/logo/thriftvault_logo.jpg');

function ScanResultCard({
  scenario,
  onBuyAndTrack,
  onAddToCloset,
  onSkip,
  onSaveForLater,
  theme,
  styles,
}: {
  scenario: ScanScenario;
  onBuyAndTrack: () => void;
  onAddToCloset: () => void;
  onSkip: () => void;
  onSaveForLater: () => void;
  theme: Theme;
  styles: ReturnType<typeof createScanStyles>;
}) {
  const c = scenario.confidence;
  const confPresentation =
    c === 'low' || c === 'medium' || c === 'high' ? getConfidencePresentation(c, theme) : null;

  const authPresentation = scenario.authenticity
    ? getAuthenticityPresentation(scenario.authenticity, theme)
    : null;

  return (
    <View style={styles.resultCard}>
      <View style={styles.resultHeader}>
        <Text style={styles.resultName}>{scenario.name}</Text>
        <Text style={styles.resultProfit}>{scenario.profit}</Text>
      </View>
      <Text style={styles.resultSub}>{scenario.sub}</Text>
      {authPresentation ? (
        <View style={[styles.authenticityBanner, { backgroundColor: authPresentation.bg }]}>
          <AppIcon
            name={authPresentation.icon as any}
            size={16}
            color={authPresentation.color}
          />
          <View style={styles.authenticityBody}>
            <Text style={[styles.authenticityLabel, { color: authPresentation.color }]}>
              {authPresentation.label}
            </Text>
            {scenario.authenticityNote ? (
              <Text style={[styles.authenticityNote, { color: authPresentation.color }]}>
                {scenario.authenticityNote}
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}
      {confPresentation ? (
        <View style={[styles.confidenceBanner, { backgroundColor: confPresentation.bg }]}>
          <View style={[styles.confidenceDot, { backgroundColor: confPresentation.color }]} />
          <Text style={[styles.confidenceText, { color: confPresentation.color }]}>
            {confPresentation.label}
          </Text>
        </View>
      ) : null}
      <View style={styles.ideaRows}>
        {scenario.ideas.slice(0, 3).map((idea, i) => (
          <View key={i} style={styles.ideaRow}>
            <AppIcon
              name={idea.ideaIcon as any}
              size={18}
              color={theme.colors.vintageBlueDark}
            />
            <View style={styles.ideaBody}>
              <Text style={styles.ideaText}>{idea.t}</Text>
            </View>
          </View>
        ))}
      </View>
      <Text style={styles.priceHint}>
        Estimated resale — edit on the next screen.
      </Text>
      <View style={styles.resultActions}>
        <Pressable
          style={({ pressed }) => [styles.btnPrimary, pressed && styles.btnPressed]}
          onPress={onBuyAndTrack}
        >
          <Text style={styles.btnPrimaryText}>Buy & Track</Text>
        </Pressable>
        <View style={styles.resultActionsRow}>
          <Pressable
            style={({ pressed }) => [styles.btnSecondary, pressed && styles.btnPressed]}
            onPress={onAddToCloset}
          >
            <Text style={styles.btnSecondaryText}>Add to Closet</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.btnSecondary, pressed && styles.btnPressed]}
            onPress={onSaveForLater}
          >
            <Text style={styles.btnSecondaryText}>Save for Later</Text>
          </Pressable>
        </View>
        <Pressable
          style={({ pressed }) => [styles.btnTertiary, pressed && styles.btnPressed]}
          onPress={onSkip}
        >
          <Text style={styles.btnTertiaryText}>Skip</Text>
        </Pressable>
      </View>
    </View>
  );
}

function createScanStyles(theme: Theme, formMaxWidth?: number) {
  return StyleSheet.create({
    resultCard: {
      marginHorizontal: 20,
      marginTop: 20,
      padding: theme.spacing.lg,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.surface,
      ...(formMaxWidth ? { maxWidth: formMaxWidth, alignSelf: 'center' as const, width: '100%' as const } : {}),
      ...(theme.shadows.sm ?? {}),
    },
    resultHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    resultName: {
      flex: 1,
      ...theme.typography.h2,
      color: theme.colors.charcoal,
    },
    resultProfit: {
      ...theme.typography.body,
      fontWeight: '700',
      color: theme.colors.profit,
    },
    resultSub: {
      ...theme.typography.caption,
      color: theme.colors.mauve,
      marginTop: 4,
      lineHeight: 20,
    },
    ideaRows: { gap: 8, marginTop: 12 },
    ideaRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
    },
    ideaBody: {
      flex: 1,
      minWidth: 0,
    },
    ideaText: {
      ...theme.typography.bodySmall,
      color: theme.colors.charcoal,
      lineHeight: 20,
    },
    ideaP: {
      ...theme.typography.caption,
      color: theme.colors.profit,
      marginTop: 4,
    },
    priceHint: {
      ...theme.typography.caption,
      color: theme.colors.mauve,
      marginTop: theme.spacing.md,
      lineHeight: 18,
    },
    resultActions: {
      marginTop: theme.spacing.md,
      gap: theme.spacing.sm,
    },
    resultActionsRow: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
    btnPrimary: {
      minHeight: theme.minTouchTargetSize,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      borderRadius: theme.radius.sm,
      backgroundColor: theme.colors.vintageBlueDark,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnPressed: { opacity: 0.85 },
    btnPrimaryText: {
      ...theme.typography.body,
      fontWeight: '600',
      color: theme.colors.onPrimary,
    },
    btnSecondary: {
      flex: 1,
      minHeight: theme.minTouchTargetSize,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radius.sm,
      borderWidth: 1,
      borderColor: theme.colors.surfaceVariant,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnSecondaryText: {
      ...theme.typography.bodySmall,
      fontWeight: '500',
      color: theme.colors.charcoal,
    },
    btnTertiary: {
      alignSelf: 'center',
      minHeight: theme.minTouchTargetSize,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnTertiaryText: {
      ...theme.typography.bodySmall,
      color: theme.colors.mauve,
    },
    confidenceBanner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      marginTop: 8,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: theme.radius.sm,
    },
    confidenceDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      marginTop: 4,
      flexShrink: 0,
    },
    confidenceText: {
      ...theme.typography.caption,
      flex: 1,
    },
    authenticityBanner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      marginTop: 8,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: theme.radius.sm,
    },
    authenticityBody: {
      flex: 1,
      gap: 2,
    },
    authenticityLabel: {
      ...theme.typography.caption,
      fontWeight: '600',
    },
    authenticityNote: {
      ...theme.typography.caption,
      lineHeight: 18,
    },
  });
}

const CAMERA_AVAILABLE = Platform.OS === 'ios' || Platform.OS === 'android';

export default function ScanScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { theme } = useTheme();
  const { inventory, addItem, updateItem } = useInventory();
  const { showToast } = useToast();
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'back' | 'front'>('back');
  const [cameraReady, setCameraReady] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanScenario | null>(null);
  const [capturedPhotoUri, setCapturedPhotoUri] = useState<string | null>(null);
  const [placeholderImageUri, setPlaceholderImageUri] = useState<string | null>(null);
  const [savedForLater, setSavedForLater] = useState<SavedScanItem[]>([]);
  const [duplicateChoiceVisible, setDuplicateChoiceVisible] = useState(false);
  const [pendingIntent, setPendingIntent] = useState<'flip' | 'closet' | null>(null);
  const [duplicateCandidates, setDuplicateCandidates] = useState<Item[]>([]);
  const [duplicatePickerVisible, setDuplicatePickerVisible] = useState(false);
  const cameraRef = useRef<{ takePictureAsync: (opts?: { quality?: number }) => Promise<{ uri: string }> } | null>(null);
  const scanningRef = useRef(false);
  const { isTablet, isDesktop, hPad, headerHPad, formMaxWidth } = useResponsive();
  const scanStyles = useMemo(() => createScanStyles(theme, formMaxWidth), [theme, formMaxWidth]);
  const styles = useMemo(() => createStyles(theme, hPad, headerHPad, isTablet, formMaxWidth), [theme, hPad, headerHPad, isTablet, formMaxWidth]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        setCameraActive(false);
        setCameraReady(false);
      };
    }, [])
  );

  useEffect(() => {
    AsyncStorage.getItem(SAVED_LATER_KEY).then((raw) => {
      try {
        const parsed = raw ? JSON.parse(raw) : [];
        if (Array.isArray(parsed)) setSavedForLater(parsed);
      } catch {
        // ignore
      }
    });
  }, []);

  const persistSavedForLater = useCallback((list: SavedScanItem[]) => {
    AsyncStorage.setItem(SAVED_LATER_KEY, JSON.stringify(list));
  }, []);

  const runScan = useCallback(async (photoUri?: string | null) => {
    if (scanningRef.current) return;
    if (!photoUri) {
      showToast('Scan needs a photo. Use the camera or photo library on your phone.');
      return;
    }
    scanningRef.current = true;
    setResult(null);
    setCapturedPhotoUri(photoUri);
    setScanning(true);
    try {
      const geminiResult = await scanWithGemini(photoUri);
      setResult(geminiResult);
    } catch (error) {
      console.error('[ThriftVault] Gemini scan failed:', error);
      const message = error instanceof Error ? error.message : String(error ?? '');
      if (message.includes('API 429')) {
        showToast('AI scan quota reached. Add billing or wait for quota reset.');
      } else {
        showToast('Couldn\'t identify — try getting the label in frame');
      }
    } finally {
      scanningRef.current = false;
      setScanning(false);
    }
  }, [showToast]);

  const handleCaptureAndScan = useCallback(async () => {
    if (!CAMERA_AVAILABLE || scanning || !cameraReady) return;
    setResult(null);
    setCapturedPhotoUri(null);
    try {
      const photo = await cameraRef.current?.takePictureAsync?.({ quality: 0.8 });
      setCameraActive(false);
      setCameraReady(false);
      if (photo?.uri) setPlaceholderImageUri(photo.uri);
      runScan(photo?.uri ?? null);
    } catch {
      setCameraActive(false);
      setCameraReady(false);
      showToast("Couldn't capture photo — try again");
    }
  }, [cameraReady, runScan, scanning]);

  const handleTapToScan = useCallback(async () => {
    if (!CAMERA_AVAILABLE) {
      runScan();
      return;
    }
    if (cameraActive) return;
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (granted) setCameraActive(true);
      else showToast('Camera access is needed to scan');
      return;
    }
    setCameraActive(true);
  }, [CAMERA_AVAILABLE, cameraActive, permission?.granted, requestPermission, runScan, showToast]);

  const handlePickFromLibrary = useCallback(async () => {
    if (scanning) return;
    if (Platform.OS === 'web') {
      showToast('Upload is not available on web');
      return;
    }
    try {
      const pickResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsEditing: false,
      });
      if (pickResult.canceled || !pickResult.assets?.[0]?.uri) return;
      const uri = pickResult.assets[0].uri;
      setPlaceholderImageUri(uri);
      setCapturedPhotoUri(uri);
      runScan(uri);
    } catch {
      showToast('Could not open photo library');
    }
  }, [runScan, showToast, scanning]);

  const clearResultAndPhoto = useCallback(() => {
    setResult(null);
    setCapturedPhotoUri(null);
    setPlaceholderImageUri(null);
  }, []);

  const getItemImageUri = useCallback(async (itemId: number, photoUri: string | null): Promise<string> => {
    if (!photoUri || !photoUri.startsWith('file:')) return DEFAULT_ITEM_PLACEHOLDER_IMAGE;
    const docDir = FileSystem.documentDirectory;
    if (!docDir) return photoUri;
    try {
      const dest = `${docDir}item_${itemId}.jpg`;
      await FileSystem.copyAsync({ from: photoUri, to: dest });
      return dest;
    } catch {
      return photoUri;
    }
  }, []);

  const getUpdateImageUri = useCallback(async (itemId: number, photoUri: string | null): Promise<string> => {
    if (!photoUri) return '';
    if (!photoUri.startsWith('file:')) return photoUri;
    const docDir = FileSystem.documentDirectory;
    if (!docDir) return photoUri;
    try {
      const dest = `${docDir}item_${itemId}_${Date.now()}.jpg`;
      await FileSystem.copyAsync({ from: photoUri, to: dest });
      return dest;
    } catch {
      return photoUri;
    }
  }, []);

  const normalizeName = useCallback((name: string) => name.trim().toLowerCase(), []);

  /** Tokenize a name into meaningful words (drop short filler words). */
  const tokenize = useCallback((name: string) => {
    return normalizeName(name)
      .replace(/[^a-z0-9]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 1);
  }, [normalizeName]);

  /** Check if two item names are similar enough to be the same item. */
  const isSimilarName = useCallback((a: string, b: string) => {
    if (normalizeName(a) === normalizeName(b)) return true;
    const tokensA = tokenize(a);
    const tokensB = tokenize(b);
    if (tokensA.length === 0 || tokensB.length === 0) return false;
    const setB = new Set(tokensB);
    const overlap = tokensA.filter((t) => setB.has(t)).length;
    const shorter = Math.min(tokensA.length, tokensB.length);
    return overlap >= Math.ceil(shorter * 0.6);
  }, [normalizeName, tokenize]);

  const createSnapshot = useCallback((scenario: ScanScenario, sourceImageUri?: string): ItemScanSnapshot => ({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
    sub: scenario.sub ?? '',
    profit: scenario.profit ?? '',
    confidence: scenario.confidence,
    ideas: Array.isArray(scenario.ideas) ? scenario.ideas.slice(0, 3) : [],
    sourceImageUri,
  }), []);

  const createItemFromScan = useCallback(async (intent: 'flip' | 'closet') => {
    if (!result) return;
    const id = Date.now();
    const paid = 0;
    const resale = intent === 'flip' ? (result.suggestedResale ?? 45) : 0;
    const imgUri = await getItemImageUri(id, capturedPhotoUri);
    const snapshot = createSnapshot(result, imgUri || undefined);
    const newItem: Item = {
      id,
      name: result.name,
      cat: result.category ?? 'tops',
      paid,
      resale,
      status: 'unlisted',
      date: new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      store: '',
      platform: 'Depop',
      notes: '',
      soldPrice: null,
      img: imgUri || DEFAULT_ITEM_PLACEHOLDER_IMAGE,
      photos: imgUri ? [imgUri] : undefined,
      intent,
      scanSnapshots: [snapshot],
      activeScanSnapshotId: snapshot.id,
    };
    addItem(newItem);
    clearResultAndPhoto();
    router.push({ pathname: '/detail', params: { itemId: String(id), fromScan: '1' } });
  }, [result, getItemImageUri, capturedPhotoUri, createSnapshot, addItem, clearResultAndPhoto, router]);

  const updateExistingFromScan = useCallback(async (target: Item) => {
    if (!result) return;
    const newCoverUri = await getUpdateImageUri(target.id, capturedPhotoUri);
    const existingPhotos = target.photos && target.photos.length > 0 ? target.photos : (target.img ? [target.img] : []);
    const mergedPhotos = newCoverUri
      ? [newCoverUri, ...existingPhotos.filter((uri) => uri !== newCoverUri)]
      : existingPhotos;
    const snapshot = createSnapshot(result, newCoverUri || undefined);
    const nextSnapshots = [snapshot, ...(target.scanSnapshots ?? [])].slice(0, SNAPSHOT_CAP);
    updateItem(target.id, {
      img: newCoverUri || target.img,
      photos: mergedPhotos.length > 0 ? mergedPhotos : target.photos,
      scanSnapshots: nextSnapshots,
      activeScanSnapshotId: snapshot.id,
    });
    setDuplicateChoiceVisible(false);
    setDuplicatePickerVisible(false);
    setPendingIntent(null);
    setDuplicateCandidates([]);
    clearResultAndPhoto();
    router.push({ pathname: '/detail', params: { itemId: String(target.id), fromScan: '1' } });
  }, [result, getUpdateImageUri, capturedPhotoUri, createSnapshot, updateItem, clearResultAndPhoto, router]);

  const isOldOrSold = useCallback((item: Item) => {
    if (item.status === 'sold') return true;
    const itemDate = new Date(item.date);
    if (Number.isNaN(itemDate.getTime())) return false;
    const ageMs = Date.now() - itemDate.getTime();
    return ageMs > OLD_ITEM_DAYS_THRESHOLD * 24 * 60 * 60 * 1000;
  }, []);

  const handleDuplicateChoice = useCallback((intent: 'flip' | 'closet') => {
    if (!result) return;
    const matches = inventory.filter((item) =>
      isSimilarName(item.name, result.name) &&
      (!result.category || item.cat === result.category)
    );
    if (matches.length === 0) {
      void createItemFromScan(intent);
      return;
    }
    setPendingIntent(intent);
    setDuplicateCandidates(matches);
    setDuplicateChoiceVisible(true);
  }, [result, isSimilarName, inventory, createItemFromScan]);

  const handleBuyAndTrack = useCallback(async () => {
    if (!result) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    handleDuplicateChoice('flip');
  }, [result, handleDuplicateChoice]);

  const handleAddToCloset = useCallback(async () => {
    if (!result) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    handleDuplicateChoice('closet');
  }, [result, handleDuplicateChoice]);

  const handleSkip = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    showToast('Skipped! Keep hunting');
    clearResultAndPhoto();
  }, [showToast, clearResultAndPhoto]);

  const handleSaveForLater = useCallback(() => {
    if (!result) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const saved: SavedScanItem = { ...result, savedAt: Date.now(), photoUri: capturedPhotoUri };
    setSavedForLater((prev) => {
      const next = [...prev, saved];
      persistSavedForLater(next);
      return next;
    });
    showToast('Saved for later');
    clearResultAndPhoto();
  }, [result, showToast, clearResultAndPhoto, persistSavedForLater]);

  const openSavedItem = useCallback((saved: SavedScanItem) => {
    setSavedForLater((prev) => {
      const next = prev.filter((s) => s.savedAt !== saved.savedAt);
      persistSavedForLater(next);
      return next;
    });
    setCapturedPhotoUri(saved.photoUri ?? null);
    setPlaceholderImageUri(saved.photoUri ?? null);
    setResult(saved);
  }, [persistSavedForLater]);

  const recents = useMemo(
    () => inventory.slice(-RECENTS_COUNT).reverse(),
    [inventory]
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Scan</Text>
          <Text style={styles.sub}>Find your next flip</Text>
        </View>
        <View style={styles.cameraBox}>
          {CAMERA_AVAILABLE && permission && !permission.granted && !permission.canAskAgain ? (
            <View style={styles.permissionDenied}>
              <AppIcon name="lock-closed" size={36} color={theme.colors.mauve} />
              <Text style={styles.permissionDeniedTitle}>Camera access denied</Text>
              <Text style={styles.permissionDeniedSub}>
                Enable camera access in Settings to scan items.
              </Text>
              <Pressable
                style={({ pressed }) => [styles.permissionDeniedBtn, pressed && styles.cameraPressed]}
                onPress={() => Linking.openSettings()}
              >
                <Text style={styles.permissionDeniedBtnText}>Open Settings</Text>
              </Pressable>
            </View>
          ) : cameraActive && permission?.granted && CAMERA_AVAILABLE ? (
            <>
              <CameraView
                ref={cameraRef as any}
                style={styles.cameraLive}
                facing={cameraFacing}
                onCameraReady={() => setCameraReady(true)}
              />
              <View style={styles.cameraOverlayWrap}>
                <BlurView intensity={40} tint="dark" style={[styles.cameraOverlayBtnBlur, styles.cameraOverlayClose]}>
                  <Pressable
                    style={({ pressed }) => [styles.cameraOverlayBtn, pressed && styles.cameraPressed]}
                    onPress={() => { setCameraActive(false); setCameraReady(false); }}
                  >
                    <AppIcon name="close" size={22} color={theme.colors.white} />
                    <Text style={styles.cameraOverlayBtnText}>Close</Text>
                  </Pressable>
                </BlurView>
                <BlurView intensity={40} tint="dark" style={[styles.cameraOverlayBtnBlur, styles.cameraOverlayFlip]}>
                  <Pressable
                    style={({ pressed }) => [styles.cameraOverlayBtn, pressed && styles.cameraPressed]}
                    onPress={() => setCameraFacing((f) => (f === 'back' ? 'front' : 'back'))}
                  >
                    <AppIcon name="camera-reverse-outline" size={22} color={theme.colors.white} />
                    <Text style={styles.cameraOverlayBtnText}>Flip</Text>
                  </Pressable>
                </BlurView>
                <View style={styles.cameraOverlayShutterWrap}>
                  <BlurView intensity={50} tint="light" style={styles.shutterBlur}>
                    <Pressable
                      style={({ pressed }) => [styles.shutterRing, styles.shutterRingLive, pressed && styles.cameraPressed]}
                      onPress={handleCaptureAndScan}
                      disabled={scanning || !cameraReady}
                    >
                      {scanning ? (
                        <ActivityIndicator size="small" color={theme.colors.white} />
                      ) : (
                        <AppIcon name="camera" size={28} color={theme.colors.white} />
                      )}
                    </Pressable>
                  </BlurView>
                </View>
              </View>
            </>
          ) : (
            <Pressable
              style={({ pressed }) => [styles.cameraBgWrap, pressed && styles.cameraPressed]}
              onPress={handleTapToScan}
              disabled={scanning || !!result}
            >
              {isDesktop ? (
                <View style={styles.cameraBg}>
                  <Image
                    source={placeholderImageUri ? { uri: placeholderImageUri } : SCAN_BG_SOURCE}
                    style={styles.cameraBgImage}
                    resizeMode="contain"
                  />
                  {!result && <View style={styles.cameraOverlay} />}
                  {!result && (scanning ? (
                    <View style={styles.searchingWrap}>
                      <ActivityIndicator size="large" color={theme.colors.white} />
                      <Text style={styles.searchingText}>Searching</Text>
                    </View>
                  ) : (
                    <View style={styles.cameraPrompt}>
                      <Text style={styles.cameraLabel}>Tap to scan</Text>
                      <View style={styles.cameraActions}>
                        <View style={styles.cameraActionSlot} />
                        <BlurView intensity={50} tint="light" style={styles.shutterBlur}>
                          <View style={styles.shutterRing}>
                            <AppIcon name="camera" size={26} color={theme.colors.white} />
                          </View>
                        </BlurView>
                        <View style={styles.cameraActionSlot} />
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <ImageBackground
                  source={placeholderImageUri ? { uri: placeholderImageUri } : SCAN_BG_SOURCE}
                  style={styles.cameraBg}
                  imageStyle={styles.cameraBgImageMobile}
                >
                  {!result && <View style={styles.cameraOverlay} />}
                  {!result && (scanning ? (
                    <View style={styles.searchingWrap}>
                      <ActivityIndicator size="large" color={theme.colors.white} />
                      <Text style={styles.searchingText}>Searching</Text>
                    </View>
                  ) : (
                    <View style={styles.cameraPrompt}>
                      <Text style={styles.cameraLabel}>Tap to scan</Text>
                      <View style={styles.cameraActions}>
                        <View style={styles.cameraActionSlot} />
                        <BlurView intensity={50} tint="light" style={styles.shutterBlur}>
                          <View style={styles.shutterRing}>
                            <AppIcon name="camera" size={26} color={theme.colors.white} />
                          </View>
                        </BlurView>
                        <View style={styles.cameraActionSlot}>
                          {Platform.OS !== 'web' && (
                            <BlurView intensity={40} tint="dark" style={styles.uploadBtnBlur}>
                              <Pressable
                                style={({ pressed }) => [styles.uploadIconBtn, pressed && styles.cameraPressed]}
                                onPress={handlePickFromLibrary}
                              >
                                <AppIcon name="images-outline" size={26} color={theme.colors.white} />
                              </Pressable>
                            </BlurView>
                          )}
                        </View>
                      </View>
                    </View>
                  ))}
                </ImageBackground>
              )}
            </Pressable>
          )}
          {result && !scanning && !cameraActive && (
            <BlurView intensity={50} tint="light" style={styles.clearBtnBlur}>
              <Pressable
                style={({ pressed }) => [styles.clearBtn, pressed && styles.cameraPressed]}
                onPress={clearResultAndPhoto}
              >
                <AppIcon name="refresh" size={18} color={theme.colors.white} />
                <Text style={styles.clearBtnText}>Clear</Text>
              </Pressable>
            </BlurView>
          )}
        </View>

        {result && (
          <ScanResultCard
            scenario={result}
            onBuyAndTrack={handleBuyAndTrack}
            onAddToCloset={handleAddToCloset}
            onSkip={handleSkip}
            onSaveForLater={handleSaveForLater}
            theme={theme}
            styles={scanStyles}
          />
        )}

        {savedForLater.length > 0 && (
          <View style={styles.recentsSection}>
            <View style={styles.recentsHeader}>
              <Text style={styles.recentsTitle}>Saved for later</Text>
            </View>
            <FlatList
              data={savedForLater}
              horizontal
              keyExtractor={(item) => String(item.savedAt)}
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => (
                <Pressable
                  style={({ pressed }) => [styles.recentCard, pressed && styles.btnPressed]}
                  onPress={() => openSavedItem(item)}
                >
                  <View style={styles.savedImgWrap}>
                    {item.photoUri ? (
                      <Image source={{ uri: item.photoUri }} style={styles.recentImg} />
                    ) : (
                      <View style={styles.savedPlaceholder} />
                    )}
                    <View style={styles.savedBadge}>
                      <AppIcon name="bookmark" size={12} color={theme.colors.onPrimary} />
                    </View>
                  </View>
                  <Text style={styles.recentName} numberOfLines={2}>{item.name}</Text>
                  <Text style={styles.savedProfit}>{item.profit}</Text>
                </Pressable>
              )}
            />
          </View>
        )}

        {recents.length > 0 && (
          <View style={styles.recentsSection}>
            <View style={styles.recentsHeader}>
              <Text style={styles.recentsTitle}>Recent finds</Text>
              <Pressable
                onPress={() => router.replace('/(tabs)')}
                style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={styles.seeAll}>See all</Text>
              </Pressable>
            </View>
            <FlatList
              data={recents}
              horizontal
              keyExtractor={(item) => String(item.id)}
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => (
                <Pressable
                  style={({ pressed }) => [styles.recentCard, pressed && styles.btnPressed]}
                  onPress={() => router.push({ pathname: '/detail', params: { itemId: String(item.id) } })}
                >
                  <Image source={{ uri: item.img }} style={styles.recentImg} />
                  <Text style={styles.recentName} numberOfLines={2}>{item.name}</Text>
                </Pressable>
              )}
            />
          </View>
        )}
      </ScrollView>
      <Modal
        visible={duplicateChoiceVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDuplicateChoiceVisible(false)}
      >
        <Pressable
          style={styles.duplicateOverlay}
          onPress={() => setDuplicateChoiceVisible(false)}
        >
          <Pressable style={styles.duplicateCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.duplicateTitle}>Looks like a match</Text>
            <Text style={styles.duplicateSub}>
              We found {duplicateCandidates.length} item{duplicateCandidates.length === 1 ? '' : 's'} with the same name.
            </Text>
            <Pressable
              style={({ pressed }) => [scanStyles.btnPrimary, pressed && scanStyles.btnPressed]}
              onPress={() => {
                if (pendingIntent) void createItemFromScan(pendingIntent);
                setDuplicateChoiceVisible(false);
              }}
            >
              <Text style={scanStyles.btnPrimaryText}>Create new item</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [scanStyles.btnSecondary, pressed && scanStyles.btnPressed]}
              onPress={() => {
                setDuplicateChoiceVisible(false);
                setDuplicatePickerVisible(true);
              }}
            >
              <Text style={scanStyles.btnSecondaryText}>Update existing item</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [scanStyles.btnTertiary, pressed && scanStyles.btnPressed]}
              onPress={() => setDuplicateChoiceVisible(false)}
            >
              <Text style={scanStyles.btnTertiaryText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
      <Modal
        visible={duplicatePickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDuplicatePickerVisible(false)}
      >
        <Pressable
          style={styles.duplicateOverlay}
          onPress={() => setDuplicatePickerVisible(false)}
        >
          <Pressable style={styles.duplicateCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.duplicateTitle}>Choose item to update</Text>
            <Text style={styles.duplicateSub}>Select one listing to apply this latest scan.</Text>
            <ScrollView style={styles.duplicateList}>
              {duplicateCandidates.map((candidate) => {
                const blocked = isOldOrSold(candidate);
                return (
                  <Pressable
                    key={candidate.id}
                    style={({ pressed }) => [
                      styles.duplicateRow,
                      blocked && styles.duplicateRowBlocked,
                      pressed && !blocked && scanStyles.btnPressed,
                    ]}
                    onPress={() => {
                      if (blocked) return;
                      void updateExistingFromScan(candidate);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: blocked }}
                    disabled={blocked}
                  >
                    <Image source={{ uri: candidate.img }} style={styles.duplicateThumb} />
                    <View style={styles.duplicateMeta}>
                      <Text numberOfLines={1} style={styles.duplicateName}>{candidate.name}</Text>
                      <Text style={styles.duplicateInfo}>
                        {candidate.date} · {candidate.status === 'sold' ? 'Sold' : 'Active'}
                      </Text>
                      {blocked && (
                        <Text style={styles.duplicateBlockedHint}>
                          {candidate.status === 'sold'
                            ? 'Sold items cannot be updated from scan'
                            : 'Older than 90 days, create a new item instead'}
                        </Text>
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Pressable
              style={({ pressed }) => [scanStyles.btnTertiary, pressed && scanStyles.btnPressed]}
              onPress={() => setDuplicatePickerVisible(false)}
            >
              <Text style={scanStyles.btnTertiaryText}>Back</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function createStyles(
  theme: Theme,
  hPad: number,
  headerHPad: number,
  isTablet: boolean,
  formMaxWidth?: number,
) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.cream,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  header: {
    paddingHorizontal: headerHPad,
    paddingTop: 20,
    paddingBottom: 14,
    ...(formMaxWidth ? { maxWidth: formMaxWidth, alignSelf: 'center' as const, width: '100%' as const } : {}),
  },
  title: {
    ...theme.typography.h1,
    color: theme.colors.charcoal,
  },
  sub: {
    ...theme.typography.bodySmall,
    color: theme.colors.mauve,
    marginTop: 2,
  },
  cameraBox: {
    marginHorizontal: hPad,
    aspectRatio: 1 / 1,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: theme.colors.charcoal,
    ...(isTablet ? { maxWidth: 600, alignSelf: 'center' as const, width: '100%' as const } : {}),
  },
  permissionDenied: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 10,
    backgroundColor: theme.colors.surfaceVariant,
  },
  permissionDeniedTitle: {
    ...theme.typography.body,
    fontWeight: '600',
    color: theme.colors.charcoal,
    textAlign: 'center',
  },
  permissionDeniedSub: {
    ...theme.typography.caption,
    color: theme.colors.mauve,
    textAlign: 'center',
  },
  permissionDeniedBtn: {
    marginTop: 6,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.vintageBlueDark,
  },
  permissionDeniedBtnText: {
    ...theme.typography.bodySmall,
    fontWeight: '600',
    color: theme.colors.onPrimary,
  },
  cameraLive: {
    flex: 1,
    width: '100%',
    borderRadius: 24,
  },
  cameraOverlayWrap: {
    ...StyleSheet.absoluteFillObject,
  },
  cameraOverlayBtnBlur: {
    borderRadius: 22,
    overflow: 'hidden',
  },
  cameraOverlayClose: {
    position: 'absolute',
    top: 16,
    right: 20,
  },
  cameraOverlayFlip: {
    position: 'absolute',
    bottom: 24,
    right: 20,
  },
  cameraOverlayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  cameraOverlayShutterWrap: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  cameraOverlayBtnText: {
    ...theme.typography.bodySmall,
    color: theme.colors.white,
    fontWeight: '600',
  },
  cameraBgWrap: {
    flex: 1,
  },
  cameraBg: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraBgImage: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 24,
  },
  cameraBgImageMobile: {
    borderRadius: 24,
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 24,
  },
  clearBtnBlur: {
    position: 'absolute',
    bottom: 16,
    alignSelf: 'center',
    borderRadius: 9999,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  clearBtnText: {
    ...theme.typography.bodySmall,
    fontWeight: '600',
    color: theme.colors.white,
  },
  cameraPressed: {
    opacity: 0.95,
  },
  searchingWrap: {
    alignItems: 'center',
    gap: 12,
  },
  searchingText: {
    ...theme.typography.body,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
  },
  cameraPrompt: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  cameraActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: 32,
  },
  cameraActionSlot: {
    flex: 1,
    alignItems: 'center',
  },
  uploadBtnBlur: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  uploadIconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterBlur: {
    borderRadius: 37,
    overflow: 'hidden',
    borderWidth: 2.5,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  shutterRing: {
    width: 66,
    height: 66,
    borderRadius: 33,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterRingLive: {
    marginBottom: 0,
  },
  cameraLabel: {
    ...theme.typography.bodySmall,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.95)',
  },
  recentsSection: {
    marginTop: 24,
    paddingHorizontal: hPad,
    ...(formMaxWidth ? { maxWidth: formMaxWidth, alignSelf: 'center' as const, width: '100%' as const } : {}),
  },
  recentsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  recentsTitle: {
    ...theme.typography.body,
    fontWeight: '600',
    color: theme.colors.charcoal,
  },
  seeAll: {
    ...theme.typography.caption,
    color: theme.colors.vintageBlueDark,
  },
  recentCard: {
    width: 100,
    marginRight: 11,
  },
  btnPressed: {
    opacity: 0.9,
  },
  recentImg: {
    width: 100,
    height: 100,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceVariant,
  },
  recentName: {
    ...theme.typography.caption,
    color: theme.colors.charcoal,
    marginTop: 4,
  },
  savedImgWrap: {
    width: 100,
    height: 100,
    borderRadius: theme.radius.sm,
    overflow: 'hidden',
    backgroundColor: theme.colors.surfaceVariant,
  },
  savedPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: theme.colors.surfaceVariant,
  },
  savedBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: theme.colors.vintageBlueDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedProfit: {
    ...theme.typography.caption,
    fontWeight: '600',
    color: theme.colors.profit,
    marginTop: 2,
  },
  duplicateOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  duplicateCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
    ...(theme.shadows.md ?? {}),
  },
  duplicateTitle: {
    ...theme.typography.h2,
    color: theme.colors.charcoal,
  },
  duplicateSub: {
    ...theme.typography.caption,
    color: theme.colors.mauve,
    marginBottom: theme.spacing.xs,
  },
  duplicateList: {
    maxHeight: 260,
    marginTop: theme.spacing.xs,
  },
  duplicateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.surfaceVariant,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  duplicateRowBlocked: {
    opacity: 0.55,
  },
  duplicateThumb: {
    width: 50,
    height: 50,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceVariant,
  },
  duplicateMeta: {
    flex: 1,
  },
  duplicateName: {
    ...theme.typography.bodySmall,
    fontWeight: '600',
    color: theme.colors.charcoal,
  },
  duplicateInfo: {
    ...theme.typography.caption,
    color: theme.colors.mauve,
    marginTop: 2,
  },
  duplicateBlockedHint: {
    ...theme.typography.caption,
    color: theme.colors.terra,
    marginTop: 4,
  },
  });
}
