import * as Clipboard from 'expo-clipboard';
import { AppIcon } from '@/components/AppIcon';
import { PaywallModal } from '@/components/PaywallModal';
import { DEFAULT_ITEM_PLACEHOLDER_IMAGE } from '@/constants/seedItems';
import { useInventory } from '@/context/InventoryContext';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { usePurchases } from '@/hooks/usePurchases';
import { useResponsive } from '@/hooks/useResponsive';
import { scanWithGemini, rescanAsHandmade, refreshUpcycleIdeas, isOverloadError } from '@/services/gemini';
import type { Theme } from '@/theme';
import type { Item, ItemScanSnapshot, ScanScenario } from '@/types/inventory';
import { getConfidencePresentation } from '@/utils/confidencePresentation';
import { formatMoney } from '@/utils/currency';
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
  AppState,
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
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SAVED_LATER_KEY = 'tv_saved_later';
const TV_PENDING_SCAN_KEY = 'tv_pending_scan';
type SavedScanItem = ScanScenario & { savedAt: number; photoUri?: string | null; photoUris?: string[] };
const SNAPSHOT_CAP = 5;
const MAX_STAGED_PHOTOS = 5;
const OLD_ITEM_DAYS_THRESHOLD = 90;

const RECENTS_COUNT = 7;

const SCAN_BG_SOURCE = require('@/assets/logo/thriftvault_logo.jpg');

function ScanResultCard({
  scenario,
  onBuyAndTrack,
  onAddToCloset,
  onSkip,
  onSaveForLater,
  onNameChange,
  onConfirmHandmade,
  rescanningHandmade,
  onRescanWrong,
  rescanningWrong,
  onRefreshUpcycle,
  refreshingUpcycle,
  customDismissed,
  onDismissCustom,
  wrongScanDismissed,
  onDismissWrongScan,
  theme,
  styles,
}: {
  scenario: ScanScenario;
  onBuyAndTrack: () => void;
  onAddToCloset: () => void;
  onSkip: () => void;
  onSaveForLater: () => void;
  onNameChange: (name: string) => void;
  onConfirmHandmade: () => void;
  rescanningHandmade: boolean;
  onRescanWrong: () => void;
  rescanningWrong: boolean;
  onRefreshUpcycle: () => void;
  refreshingUpcycle: boolean;
  customDismissed: boolean;
  onDismissCustom: () => void;
  wrongScanDismissed: boolean;
  onDismissWrongScan: () => void;
  theme: Theme;
  styles: ReturnType<typeof createScanStyles>;
}) {
  const c = scenario.confidence;
  const confPresentation =
    c === 'low' || c === 'medium' || c === 'high' ? getConfidencePresentation(c, theme) : null;

  const [editingName, setEditingName] = useState(false);
  const [editedName, setEditedName] = useState(scenario.name);
  const [upcycleExpanded, setUpcycleExpanded] = useState(false);
  const [authExpanded, setAuthExpanded] = useState(false);
  const { showToast } = useToast();

  const handleCopyIdeas = useCallback(async () => {
    const text = scenario.ideas.slice(0, 3).map((idea, i) => `${i + 1}. ${idea.t}`).join('\n');
    await Clipboard.setStringAsync(text);
    showToast('Copied');
  }, [scenario.ideas, showToast]);

  const handleCopyUpcycle = useCallback(async () => {
    if (!scenario.upcycle || scenario.upcycle.length === 0) return;
    const text = scenario.upcycle.map((tip, i) => `${i + 1}. ${tip}`).join('\n');
    await Clipboard.setStringAsync(text);
    showToast('Copied');
  }, [scenario.upcycle, showToast]);

  const commitNameEdit = () => {
    const trimmed = editedName.trim();
    if (trimmed && trimmed !== scenario.name) {
      onNameChange(trimmed);
    } else {
      setEditedName(scenario.name);
    }
    setEditingName(false);
  };

  return (
    <View style={styles.resultCard}>
      <View style={styles.resultHeader}>
        {editingName ? (
          <TextInput
            style={[styles.resultName, styles.resultNameInput]}
            value={editedName}
            onChangeText={setEditedName}
            onBlur={commitNameEdit}
            onSubmitEditing={commitNameEdit}
            autoFocus
            selectTextOnFocus
            returnKeyType="done"
          />
        ) : (
          <Pressable
            onPress={() => { setEditedName(scenario.name); setEditingName(true); }}
            style={styles.resultNameRow}
          >
            <Text style={styles.resultName}>{scenario.name}</Text>
            <AppIcon name="pencil" size={16} color={theme.colors.mauve} />
          </Pressable>
        )}
        <View style={styles.resultPriceWrap}>
          <Text style={styles.resultProfit}>
            {formatMoney(scenario.suggestedResale ?? 0)}
          </Text>
          {scenario.profit ? (
            <Text style={styles.resultRange}>{scenario.profit}</Text>
          ) : null}
        </View>
      </View>
      <Text style={styles.resultSub}>{scenario.sub}</Text>
<View style={styles.pillRow}>
        {rescanningHandmade ? (
          <View style={styles.handmadePromptRow}>
            <ActivityIndicator size="small" color={theme.colors.terra} />
            <Text style={styles.handmadePromptText}>Updating scan...</Text>
          </View>
        ) : scenario.isCustom ? (
          <View style={styles.handmadePromptRow}>
            <View style={styles.customBanner}>
              <AppIcon name="brush-outline" size={14} color={theme.colors.terra} />
              <Text style={styles.customBannerText}>Handmade</Text>
            </View>
          </View>
        ) : !customDismissed ? (
          <View style={styles.handmadePromptRow}>
            <AppIcon name="brush-outline" size={14} color={theme.colors.mauve} />
            <Text style={styles.handmadePromptText}>Is this handmade?</Text>
            <Pressable
              style={({ pressed }) => [styles.handmadeYes, pressed && { opacity: 0.7 }]}
              onPress={onConfirmHandmade}
              hitSlop={12}
            >
              <Text style={styles.handmadeYesText}>Yes</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.handmadeNo, pressed && { opacity: 0.7 }]}
              onPress={onDismissCustom}
              hitSlop={12}
            >
              <Text style={styles.handmadeNoText}>No</Text>
            </Pressable>
          </View>
        ) : null}
        {rescanningWrong ? (
          <View style={styles.handmadePromptRow}>
            <ActivityIndicator size="small" color={theme.colors.vintageBlueDark} />
            <Text style={styles.handmadePromptText}>Rescanning...</Text>
          </View>
        ) : !wrongScanDismissed && (
          <View style={styles.handmadePromptRow}>
            <AppIcon name="alert-circle-outline" size={14} color={theme.colors.mauve} />
            <Text style={styles.handmadePromptText}>Is this scan wrong?</Text>
            <Pressable
              style={({ pressed }) => [styles.handmadeYes, pressed && { opacity: 0.7 }]}
              onPress={onRescanWrong}
              hitSlop={12}
            >
              <Text style={styles.handmadeYesText}>Yes</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.handmadeNo, pressed && { opacity: 0.7 }]}
              onPress={onDismissWrongScan}
              hitSlop={12}
            >
              <Text style={styles.handmadeNoText}>No</Text>
            </Pressable>
          </View>
        )}
        {confPresentation && (
          <View style={styles.confidenceBanner}>
            <View style={styles.confidenceLead}>
              <View style={[styles.confidenceDot, { backgroundColor: confPresentation.color }]} />
            </View>
            <Text style={[styles.confidenceText, { color: confPresentation.color }]}>
              {confPresentation.label}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.ideaRows}>
        <View style={styles.ideaRowsHeader}>
          <Text style={styles.ideaRowsLabel}>Listing suggestions</Text>
          <Pressable onPress={handleCopyIdeas} hitSlop={8} style={({ pressed }) => pressed && { opacity: 0.6 }} accessibilityLabel="Copy all suggestions">
            <AppIcon name="copy-outline" size={15} color={theme.colors.mauve} />
          </Pressable>
        </View>
        {scenario.ideas.slice(0, 3).map((idea, i) => (
          <View key={i} style={styles.ideaRow}>
            <AppIcon
              name={idea.ideaIcon as any}
              size={18}
              color={theme.colors.vintageBlueDark}
            />
            <View style={styles.ideaBody}>
              <Text style={styles.ideaText} selectable>{idea.t}</Text>
            </View>
          </View>
        ))}
      </View>
      {scenario.authFlags && scenario.authFlags.length > 0 && (
        <View style={styles.authSection}>
          <Pressable
            style={styles.authHeader}
            onPress={() => setAuthExpanded((v) => !v)}
            hitSlop={4}
          >
            <AppIcon name="shield-checkmark-outline" size={15} color={theme.colors.vintageBlueDark} />
            <Text style={styles.authHeaderText}>Verify authenticity</Text>
            <AppIcon
              name={authExpanded ? 'chevron-up' : 'chevron-down'}
              size={13}
              color={theme.colors.vintageBlueDark}
            />
          </Pressable>
          {authExpanded && (
            <View style={[styles.authRows, styles.authRowsExpanded]}>
              <Text style={styles.authResellerWarning}>
                <Text style={styles.authResellerBold}>Reselling this? </Text>
                Get it professionally authenticated first. These estimates are for personal reference only — not an authenticity guarantee.
              </Text>
              {scenario.authFlags.map((flag, i) => (
                <View key={i} style={styles.authRow}>
                  <View style={styles.authDot} />
                  <Text style={styles.authText}>{flag}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
      {scenario.upcycle && scenario.upcycle.length > 0 && (
        <View style={styles.upcycleSection}>
          <Pressable
            style={styles.upcycleHeader}
            onPress={() => setUpcycleExpanded((v) => !v)}
            hitSlop={4}
          >
            <AppIcon name="color-palette-outline" size={15} color={theme.colors.terra} />
            <Text style={styles.upcycleHeaderText}>Upcycle ideas</Text>
            {upcycleExpanded && (
              <Pressable onPress={handleCopyUpcycle} hitSlop={8} style={({ pressed }) => pressed && { opacity: 0.6 }} accessibilityLabel="Copy upcycle ideas">
                <AppIcon name="copy-outline" size={15} color={theme.colors.terra} />
              </Pressable>
            )}
            <AppIcon
              name={upcycleExpanded ? 'chevron-up' : 'chevron-down'}
              size={14}
              color={theme.colors.terra}
            />
          </Pressable>
          {upcycleExpanded && (
            <View style={styles.upcycleRows}>
              {scenario.upcycle.map((tip, i) => (
                <View key={i} style={styles.upcycleRow}>
                  <View style={styles.upcycleDot} />
                  <Text style={styles.upcycleText} selectable>{tip}</Text>
                </View>
              ))}
              <Pressable
                onPress={onRefreshUpcycle}
                disabled={refreshingUpcycle}
                hitSlop={8}
                style={({ pressed }) => [styles.upcycleRegenerate, pressed && { opacity: 0.6 }]}
                accessibilityLabel="Regenerate upcycle ideas"
              >
                {refreshingUpcycle ? (
                  <ActivityIndicator size="small" color={theme.colors.terra} />
                ) : (
                  <AppIcon name="reload-outline" size={13} color={theme.colors.terra} />
                )}
                <Text style={styles.upcycleRegenerateText}>
                  {refreshingUpcycle ? 'Regenerating...' : 'Regenerate ideas'}
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      )}
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
    resultNameRow: {
      flex: 1,
      flexDirection: 'row' as const,
      alignItems: 'flex-start' as const,
      gap: 6,
    },
    resultNameInput: {
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.vintageBlueDark,
      paddingVertical: 2,
    },
    resultPriceWrap: {
      alignItems: 'flex-end' as const,
    },
    resultProfit: {
      ...theme.typography.h2,
      fontWeight: '700',
      color: theme.colors.profit,
    },
    resultRange: {
      ...theme.typography.caption,
      color: theme.colors.mauve,
    },
    resultDisclaimer: {
      fontFamily: 'DMSans_400Regular',
      fontSize: 10,
      lineHeight: 14,
      color: theme.colors.mauve,
      textAlign: 'center',
      marginTop: 14,
      opacity: 0.8,
    },
    resultSub: {
      ...theme.typography.caption,
      color: theme.colors.mauve,
      marginTop: 4,
      lineHeight: 20,
    },
    ideaRows: { gap: 8, marginTop: 12, borderTopWidth: 1, borderTopColor: theme.colors.surfaceVariant, paddingTop: 12 },
    ideaRowsHeader: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      marginBottom: 2,
    },
    ideaRowsLabel: {
      ...theme.typography.label,
      color: theme.colors.mauve,
    },
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
    upcycleSection: {
      marginTop: theme.spacing.md,
      borderTopWidth: 1,
      borderTopColor: theme.colors.surfaceVariant,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.surfaceVariant,
      paddingVertical: theme.spacing.sm,
    },
    upcycleHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    upcycleHeaderText: {
      ...theme.typography.caption,
      color: theme.colors.terra,
      fontWeight: '600',
      flex: 1,
    },
    upcycleRows: {
      marginTop: theme.spacing.sm,
      gap: 6,
    },
    upcycleRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
    },
    upcycleDot: {
      width: 5,
      height: 5,
      borderRadius: 3,
      backgroundColor: theme.colors.terra,
      marginTop: 6,
    },
    upcycleText: {
      ...theme.typography.bodySmall,
      color: theme.colors.charcoal,
      flex: 1,
      lineHeight: 20,
    },
    upcycleRegenerate: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 6,
      marginTop: theme.spacing.sm,
    },
    upcycleRegenerateText: {
      ...theme.typography.caption,
      color: theme.colors.terra,
      fontWeight: '600',
    },
    authSection: {
      marginTop: theme.spacing.md,
      borderTopWidth: 1,
      borderTopColor: theme.colors.surfaceVariant,
      paddingVertical: theme.spacing.sm,
    },
    authHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    authRowsExpanded: {
      marginTop: theme.spacing.sm,
    },
    authHeaderText: {
      ...theme.typography.caption,
      color: theme.colors.vintageBlueDark,
      fontWeight: '600',
      flex: 1,
    },
    authRows: {
      gap: 6,
    },
    authRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
    },
    authDot: {
      width: 5,
      height: 5,
      borderRadius: 3,
      backgroundColor: theme.colors.vintageBlueDark,
      marginTop: 6,
    },
    authText: {
      ...theme.typography.bodySmall,
      color: theme.colors.charcoal,
      flex: 1,
      lineHeight: 20,
    },
    authResellerWarning: {
      ...theme.typography.caption,
      color: theme.colors.terra,
      lineHeight: 18,
    },
    authResellerBold: {
      fontFamily: 'DMSans_600SemiBold',
    },
    resultActions: {
      marginTop: theme.spacing.lg,
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
    pillRow: {
      flexDirection: 'column',
      gap: 6,
      marginTop: 8,
    },
    confidenceBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 6,
    },
    confidenceLead: {
      width: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    confidenceDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      flexShrink: 0,
    },
    confidenceText: {
      ...theme.typography.caption,
    },
    customBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 6,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.terraLight,
    },
    customBannerText: {
      ...theme.typography.caption,
      color: theme.colors.terra,
      fontWeight: '600',
    },
    handmadePromptRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      minHeight: 36,
    },
    handmadePromptText: {
      ...theme.typography.caption,
      color: theme.colors.mauve,
    },
    handmadeYes: {
      justifyContent: 'center',
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.terraLight,
    },
    handmadeYesText: {
      ...theme.typography.caption,
      fontWeight: '600',
      color: theme.colors.terra,
    },
    handmadeNo: {
      justifyContent: 'center',
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.mauveLight,
    },
    handmadeNoText: {
      ...theme.typography.caption,
      fontWeight: '600',
      color: theme.colors.mauve,
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
  const { isPro } = usePurchases();
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'back' | 'front'>('back');
  const [cameraReady, setCameraReady] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState<string | null>(null);
  const [result, setResult] = useState<ScanScenario | null>(null);
  const [stagedPhotos, setStagedPhotos] = useState<string[]>([]);
  const [placeholderImageUri, setPlaceholderImageUri] = useState<string | null>(null);
  const [savedForLater, setSavedForLater] = useState<SavedScanItem[]>([]);
  const [duplicateChoiceVisible, setDuplicateChoiceVisible] = useState(false);
  const [pendingIntent, setPendingIntent] = useState<'flip' | 'closet' | null>(null);
  const [duplicateCandidates, setDuplicateCandidates] = useState<Item[]>([]);
  const [duplicatePickerVisible, setDuplicatePickerVisible] = useState(false);
  const [rescanningHandmade, setRescanningHandmade] = useState(false);
  const [rescanningWrong, setRescanningWrong] = useState(false);
  const [refreshingUpcycle, setRefreshingUpcycle] = useState(false);
  const [promptCustomDismissed, setPromptCustomDismissed] = useState(false);
  const [promptWrongScanDismissed, setPromptWrongScanDismissed] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const cameraRef = useRef<{ takePictureAsync: (opts?: { quality?: number }) => Promise<{ uri: string }> } | null>(null);
  const scanningRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const appStateRef = useRef(AppState.currentState);
  const pendingRetryRef = useRef(false);
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
    AsyncStorage.getItem(TV_PENDING_SCAN_KEY).then((raw) => {
      try {
        const parsed = raw ? JSON.parse(raw) : null;
        if (parsed?.result) {
          setResult(parsed.result);
          if (Array.isArray(parsed.stagedPhotos) && parsed.stagedPhotos.length > 0)
            setStagedPhotos(parsed.stagedPhotos);
          if (parsed.placeholderImageUri)
            setPlaceholderImageUri(parsed.placeholderImageUri);
          if (parsed.promptCustomDismissed)
            setPromptCustomDismissed(true);
          if (parsed.promptWrongScanDismissed)
            setPromptWrongScanDismissed(true);
        }
      } catch {
        // ignore corrupt data
      }
    });
  }, []);

  const persistSavedForLater = useCallback((list: SavedScanItem[]) => {
    AsyncStorage.setItem(SAVED_LATER_KEY, JSON.stringify(list));
  }, []);

  useEffect(() => {
    if (result) {
      AsyncStorage.setItem(TV_PENDING_SCAN_KEY, JSON.stringify({
        result,
        stagedPhotos,
        placeholderImageUri,
        promptCustomDismissed,
        promptWrongScanDismissed,
      }));
    }
  }, [result, stagedPhotos, placeholderImageUri, promptCustomDismissed, promptWrongScanDismissed]);

  const cancelScan = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setScanning(false);
    scanningRef.current = false;
  }, []);

  const handleScanStaged = useCallback(async () => {
    if (scanningRef.current || stagedPhotos.length === 0) return;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    scanningRef.current = true;
    setResult(null);
    setPromptCustomDismissed(false);
    setPromptWrongScanDismissed(false);
    setScanning(true);
    setCameraActive(false);
    setCameraReady(false);
    try {
      const geminiResult = await scanWithGemini(stagedPhotos, controller.signal, setScanStatus);
      pendingRetryRef.current = false; // scan succeeded — don't retry on foreground
      setResult(geminiResult);
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') return;
      if (__DEV__) console.log('[Scan] error:', error);
      const message = error instanceof Error ? error.message : String(error ?? '');
      if (/API (429|503|529)/i.test(message) || /overloaded|high demand/i.test(message)) {
        showToast('AI is busy right now — try again in a moment');
      } else {
        showToast('Couldn\'t identify — try getting the label in frame');
      }
    } finally {
      scanningRef.current = false;
      setScanning(false);
      setScanStatus(null);
      abortControllerRef.current = null;
    }
  }, [stagedPhotos, showToast]);

  // Keep a stable ref so the AppState listener always calls the latest handleScanStaged
  // without needing it in the effect's dependency array.
  const handleScanStagedRef = useRef(handleScanStaged);
  handleScanStagedRef.current = handleScanStaged;

  // Auto-retry scan when app returns to foreground after being backgrounded mid-scan.
  // Effect runs once on mount — refs keep everything up to date without re-subscribing.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      if (next === 'background' && scanningRef.current) {
        // Mark for retry — if the scan doesn't complete before we foreground, retry then.
        // Do NOT abort: iOS allows active fetches to finish in background, so aborting
        // would kill a scan that's about to succeed.
        pendingRetryRef.current = true;
      }
      if (prev !== 'active' && next === 'active' && pendingRetryRef.current) {
        pendingRetryRef.current = false;
        handleScanStagedRef.current();
      }
    });
    return () => sub.remove();
  }, []);

  const handleCapturePhoto = useCallback(async () => {
    if (!__DEV__ && !isPro) { setPaywallVisible(true); return; }
    if (!CAMERA_AVAILABLE || scanning || !cameraReady || scanningRef.current) return;
    try {
      const photo = await cameraRef.current?.takePictureAsync?.({ quality: 0.8 });
      if (!photo?.uri) return;
      setPlaceholderImageUri(photo.uri);
      setStagedPhotos([photo.uri]);
      setCameraActive(false);
      setCameraReady(false);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const controller = new AbortController();
      abortControllerRef.current = controller;
      scanningRef.current = true;
      setResult(null);
      setPromptCustomDismissed(false);
      setPromptWrongScanDismissed(false);
      setScanning(true);
      try {
        const geminiResult = await scanWithGemini([photo.uri], controller.signal, setScanStatus);
        pendingRetryRef.current = false; // scan succeeded — don't retry on foreground
        setResult(geminiResult);
      } catch (error) {
        if ((error as Error)?.name === 'AbortError') return;
        const message = error instanceof Error ? error.message : String(error ?? '');
        if (/API (429|503|529)/i.test(message) || /overloaded|high demand/i.test(message)) {
          showToast('AI is busy right now — try again in a moment');
        } else {
          showToast("Couldn't identify — try getting the label in frame");
        }
      } finally {
        scanningRef.current = false;
        setScanning(false);
        setScanStatus(null);
        abortControllerRef.current = null;
      }
    } catch {
      showToast("Couldn't capture photo — try again");
    }
  }, [cameraReady, scanning, isPro, showToast]);

  const handleRemoveStagedPhoto = useCallback((index: number) => {
    setStagedPhotos(prev => {
      const next = prev.filter((_, i) => i !== index);
      if (index === 0) setPlaceholderImageUri(next[0] ?? null);
      else if (next.length === 0) setPlaceholderImageUri(null);
      return next;
    });
  }, []);

  const handleTapToScan = useCallback(async () => {
    if (!__DEV__ && !isPro) { setPaywallVisible(true); return; }
    if (!CAMERA_AVAILABLE) {
      showToast('Scan needs a photo. Use the camera or photo library on your phone.');
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
  }, [CAMERA_AVAILABLE, cameraActive, permission?.granted, requestPermission, showToast]);

  const handlePickFromLibrary = useCallback(async () => {
    if (!__DEV__ && !isPro) { setPaywallVisible(true); return; }
    if (scanning) return;
    if (Platform.OS === 'web') {
      showToast('Upload is not available on web');
      return;
    }
    if (stagedPhotos.length >= MAX_STAGED_PHOTOS) {
      showToast(`Maximum ${MAX_STAGED_PHOTOS} photos per scan`);
      return;
    }
    try {
      const remaining = MAX_STAGED_PHOTOS - stagedPhotos.length;
      const pickResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsMultipleSelection: remaining > 1,
        selectionLimit: remaining,
        allowsEditing: false,
      });
      if (pickResult.canceled || !pickResult.assets?.length) return;
      const newUris = pickResult.assets.map(a => a.uri).slice(0, remaining);
      setStagedPhotos(prev => {
        if (prev.length === 0) setPlaceholderImageUri(newUris[0]);
        return [...prev, ...newUris];
      });
      if (cameraActive) {
        setCameraActive(false);
        setCameraReady(false);
      }
    } catch {
      showToast('Could not open photo library');
    }
  }, [showToast, scanning, stagedPhotos.length, isPro, cameraActive]);

  const clearResultAndPhoto = useCallback(() => {
    setResult(null);
    setStagedPhotos([]);
    setPlaceholderImageUri(null);
    setPromptCustomDismissed(false);
    setPromptWrongScanDismissed(false);
    AsyncStorage.removeItem(TV_PENDING_SCAN_KEY);
    setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: true }), 50);
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

  const persistPhotos = useCallback(async (itemId: number, uris: string[]): Promise<string[]> => {
    const docDir = FileSystem.documentDirectory;
    if (!docDir) return uris;
    return Promise.all(
      uris.map(async (uri, i) => {
        if (!uri.startsWith('file:')) return uri;
        try {
          const dest = `${docDir}item_${itemId}_${Date.now()}_${i}.jpg`;
          await FileSystem.copyAsync({ from: uri, to: dest });
          return dest;
        } catch { return uri; }
      })
    );
  }, []);

  const createSnapshot = useCallback((scenario: ScanScenario, sourceImageUris?: string[]): ItemScanSnapshot => ({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
    sub: scenario.sub ?? '',
    profit: scenario.profit ?? '',
    confidence: scenario.confidence,
    isCustom: scenario.isCustom || false,
    ideas: Array.isArray(scenario.ideas) ? scenario.ideas.slice(0, 3) : [],
    upcycle: Array.isArray(scenario.upcycle) ? scenario.upcycle.slice(0, 3) : [],
    authFlags: Array.isArray(scenario.authFlags) ? scenario.authFlags.slice(0, 3) : [],
    sourceImageUri: sourceImageUris?.[0],
    sourceImageUris,
  }), []);

  const createItemFromScan = useCallback(async (intent: 'flip' | 'closet') => {
    if (!result) return;
    const id = Date.now();
    const paid = null;
    const resale = intent === 'flip' ? (result.suggestedResale ?? 45) : 0;
    const persistedUris = stagedPhotos.length > 0
      ? await persistPhotos(id, stagedPhotos)
      : [];
    const coverUri = persistedUris[0] || DEFAULT_ITEM_PLACEHOLDER_IMAGE;
    const snapshot = createSnapshot(result, persistedUris.length > 0 ? persistedUris : undefined);
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
      platform: '',
      notes: '',
      soldPrice: null,
      img: coverUri,
      photos: persistedUris.length > 0 ? persistedUris : undefined,
      intent,
      scanSnapshots: [snapshot],
      activeScanSnapshotId: snapshot.id,
    };
    addItem(newItem);
    if (promptCustomDismissed || promptWrongScanDismissed) {
      AsyncStorage.setItem(`tv_prompt_dismissed_${id}`, JSON.stringify({ handmade: promptCustomDismissed, wrongScan: promptWrongScanDismissed }));
    }
    clearResultAndPhoto();
    router.push({ pathname: '/detail', params: { itemId: String(id), fromScan: '1' } });
  }, [result, persistPhotos, stagedPhotos, createSnapshot, addItem, promptCustomDismissed, promptWrongScanDismissed, clearResultAndPhoto, router]);

  const updateExistingFromScan = useCallback(async (target: Item) => {
    if (!result) return;
    const existingPhotos = target.photos && target.photos.length > 0 ? target.photos : (target.img ? [target.img] : []);

    const sizeToExistingUri = new Map<number, string>();
    await Promise.all(existingPhotos.map(async (uri) => {
      try {
        const info = await FileSystem.getInfoAsync(uri);
        if (info.exists && typeof (info as any).size === 'number') {
          sizeToExistingUri.set((info as any).size, uri);
        }
      } catch { /* ignore */ }
    }));

    const seenSizes = new Set<number>();
    const uniqueNewStaged: string[] = [];
    const snapshotReuseUris: string[] = [];
    for (const uri of stagedPhotos) {
      let size: number | null = null;
      try {
        const info = await FileSystem.getInfoAsync(uri);
        if (info.exists && typeof (info as any).size === 'number') size = (info as any).size;
      } catch { /* ignore */ }
      if (size != null) {
        if (seenSizes.has(size)) {
          const existingDupe = sizeToExistingUri.get(size);
          if (existingDupe && !snapshotReuseUris.includes(existingDupe)) {
            snapshotReuseUris.push(existingDupe);
          }
          continue;
        }
        seenSizes.add(size);
        const existingMatch = sizeToExistingUri.get(size);
        if (existingMatch) {
          snapshotReuseUris.push(existingMatch);
          continue;
        }
      }
      uniqueNewStaged.push(uri);
    }

    const persistedNew = uniqueNewStaged.length > 0
      ? await persistPhotos(target.id, uniqueNewStaged)
      : [];
    const snapshotUris = [...persistedNew, ...snapshotReuseUris];
    const mergedPhotos = persistedNew.length > 0
      ? [...persistedNew, ...existingPhotos]
      : existingPhotos;
    const snapshot = createSnapshot(result, snapshotUris.length > 0 ? snapshotUris : undefined);
    const nextSnapshots = [snapshot, ...(target.scanSnapshots ?? [])].slice(0, SNAPSHOT_CAP);
    const newResale = result.suggestedResale ?? 0;
    const resaleUpdate = newResale > (target.resale ?? 0) ? { resale: newResale, name: result.name } : {};
    updateItem(target.id, {
      img: persistedNew[0] || target.img,
      photos: mergedPhotos.length > 0 ? mergedPhotos : target.photos,
      scanSnapshots: nextSnapshots,
      activeScanSnapshotId: snapshot.id,
      updatedAt: Date.now(),
      ...resaleUpdate,
    });
    setDuplicateChoiceVisible(false);
    setDuplicatePickerVisible(false);
    setPendingIntent(null);
    setDuplicateCandidates([]);
    clearResultAndPhoto();
    router.push({ pathname: '/detail', params: { itemId: String(target.id), fromScan: '1' } });
  }, [result, persistPhotos, stagedPhotos, createSnapshot, updateItem, clearResultAndPhoto, router]);

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
    showToast('Skipped');
    clearResultAndPhoto();
  }, [showToast, clearResultAndPhoto]);

  const handleConfirmHandmade = useCallback(async () => {
    const photoUri = stagedPhotos[0];
    if (!photoUri || rescanningHandmade) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRescanningHandmade(true);
    try {
      const updated = await rescanAsHandmade(photoUri);
      setResult((prev) => {
        const prevLow = prev?.suggestedResaleLow ?? 0;
        const prevHigh = prev?.suggestedResaleHigh ?? 0;
        const newLow = Math.max(updated.suggestedResaleLow ?? 0, prevLow);
        const newHigh = Math.max(updated.suggestedResaleHigh ?? 0, prevHigh);
        const newResale = newLow > 0 ? Math.round((newLow + newHigh) / 2) : (prev?.suggestedResale ?? 0);
        return {
          ...updated,
          isCustom: true,
          suggestedResaleLow: newLow,
          suggestedResaleHigh: newHigh,
          suggestedResale: newResale,
          profit: newLow > 0 ? `${formatMoney(newLow)}–${formatMoney(newHigh)}` : (prev?.profit ?? ''),
        };
      });
    } catch (err) {
      if (__DEV__) console.log('[Handmade rescan] error:', err);
      showToast(isOverloadError(err) ? 'AI is busy — try again in a moment' : "Couldn't rescan — try again");
    } finally {
      setRescanningHandmade(false);
    }
  }, [stagedPhotos, rescanningHandmade, showToast]);

  const handleRescanWrong = useCallback(async () => {
    const photoUri = stagedPhotos[0];
    if (!photoUri || rescanningWrong) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRescanningWrong(true);
    try {
      const wasHandmade = result?.isCustom === true;
      const updated = wasHandmade
        ? await rescanAsHandmade(photoUri)
        : await scanWithGemini(photoUri);
      setResult({ ...updated, isCustom: wasHandmade || updated.isCustom });
    } catch (err) {
      if (__DEV__) console.log('[Wrong rescan] error:', err);
      showToast(isOverloadError(err) ? 'AI is busy — try again in a moment' : "Couldn't rescan — try again");
    } finally {
      setRescanningWrong(false);
    }
  }, [stagedPhotos, rescanningWrong, result, showToast]);

  const handleRefreshUpcycle = useCallback(async () => {
    const photoUri = stagedPhotos[0];
    if (!photoUri || refreshingUpcycle) return;
    setRefreshingUpcycle(true);
    try {
      const newUpcycle = await refreshUpcycleIdeas(
        photoUri,
        result ? { name: result.name, category: result.category, sub: result.sub } : undefined
      );
      setResult((prev) => prev ? { ...prev, upcycle: newUpcycle } : null);
    } catch {
      showToast("Couldn't refresh — try again");
    } finally {
      setRefreshingUpcycle(false);
    }
  }, [stagedPhotos, refreshingUpcycle, showToast]);

  const handleSaveForLater = useCallback(() => {
    if (!result) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const saved: SavedScanItem = { ...result, savedAt: Date.now(), photoUri: stagedPhotos[0] ?? null, photoUris: stagedPhotos };
    setSavedForLater((prev) => {
      const next = [...prev, saved];
      persistSavedForLater(next);
      return next;
    });
    showToast('Saved for later');
    clearResultAndPhoto();
  }, [result, stagedPhotos, showToast, clearResultAndPhoto, persistSavedForLater]);

  const openSavedItem = useCallback((saved: SavedScanItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSavedForLater((prev) => {
      const next = prev.filter((s) => s.savedAt !== saved.savedAt);
      persistSavedForLater(next);
      return next;
    });
    const restoredPhotos = saved.photoUris ?? (saved.photoUri ? [saved.photoUri] : []);
    setStagedPhotos(restoredPhotos);
    setPlaceholderImageUri(restoredPhotos[0] ?? null);
    setResult(saved);
  }, [persistSavedForLater]);

  const recents = useMemo(
    () => [...inventory]
      .sort((a, b) => (b.updatedAt ?? b.id) - (a.updatedAt ?? a.id))
      .slice(0, RECENTS_COUNT),
    [inventory]
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        ref={scrollRef}
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
                    hitSlop={8}
                    style={({ pressed }) => [styles.cameraOverlayIconBtn, pressed && styles.cameraPressed]}
                    onPress={() => { setCameraActive(false); setCameraReady(false); }}
                    accessibilityLabel="Close camera"
                  >
                    <AppIcon name="close" size={22} color={theme.colors.white} />
                  </Pressable>
                </BlurView>
                <BlurView intensity={40} tint="dark" style={[styles.cameraOverlayBtnBlur, styles.cameraOverlayFlip]}>
                  <Pressable
                    hitSlop={8}
                    style={({ pressed }) => [styles.cameraOverlayIconBtn, pressed && styles.cameraPressed]}
                    onPress={() => setCameraFacing((f) => (f === 'back' ? 'front' : 'back'))}
                    accessibilityLabel="Flip camera"
                  >
                    <AppIcon name="camera-reverse-outline" size={22} color={theme.colors.white} />
                  </Pressable>
                </BlurView>
                <View style={styles.cameraOverlayShutterWrap}>
                  <BlurView intensity={50} tint="light" style={styles.shutterBlur}>
                    <Pressable
                      style={({ pressed }) => [styles.shutterRing, styles.shutterRingLive, pressed && styles.cameraPressed]}
                      onPress={handleCapturePhoto}
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
              style={({ pressed }) => [styles.cameraBgWrap, scanStatus && styles.cameraBgWrapHandmade, pressed && styles.cameraPressed]}
              onPress={handleTapToScan}
              disabled={scanning || !!result || stagedPhotos.length > 0}
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
                      {scanStatus && (
                        <View style={styles.scanStatusPill}>
                          <AppIcon name="brush-outline" size={14} color={theme.colors.terra} />
                          <Text style={styles.scanStatusPillText}>{scanStatus}</Text>
                        </View>
                      )}
                      <BlurView intensity={40} tint="dark" style={styles.cancelPill}>
                        <Pressable style={({ pressed }) => [styles.clearBtn, pressed && styles.cameraPressed]} onPress={cancelScan} hitSlop={8}>
                          <Text style={styles.clearBtnText}>Cancel</Text>
                        </Pressable>
                      </BlurView>
                    </View>
                  ) : (
                    <View style={styles.cameraPrompt}>
                      <Text style={styles.cameraLabel}>
                        {stagedPhotos.length > 0 ? `Scan ${stagedPhotos.length} photo${stagedPhotos.length === 1 ? '' : 's'}` : 'Tap to scan'}
                      </Text>
                      <View style={styles.cameraActions}>
                        <View style={styles.cameraActionSlot} />
                        <BlurView intensity={50} tint="light" style={styles.shutterBlur}>
                          {stagedPhotos.length > 0 ? (
                            <Pressable
                              style={({ pressed }) => [styles.shutterRing, pressed && styles.cameraPressed]}
                              onPress={handleScanStaged}
                              accessibilityLabel={`Scan ${stagedPhotos.length} photos`}
                            >
                              <AppIcon name="search" size={26} color={theme.colors.white} />
                            </Pressable>
                          ) : (
                            <View style={styles.shutterRing}>
                              <AppIcon name="camera" size={26} color={theme.colors.white} />
                            </View>
                          )}
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
                      {scanStatus && (
                        <View style={styles.scanStatusPill}>
                          <AppIcon name="brush-outline" size={14} color={theme.colors.terra} />
                          <Text style={styles.scanStatusPillText}>{scanStatus}</Text>
                        </View>
                      )}
                      <BlurView intensity={40} tint="dark" style={styles.cancelPill}>
                        <Pressable style={({ pressed }) => [styles.clearBtn, pressed && styles.cameraPressed]} onPress={cancelScan} hitSlop={8}>
                          <Text style={styles.clearBtnText}>Cancel</Text>
                        </Pressable>
                      </BlurView>
                    </View>
                  ) : (
                    <View style={styles.cameraPrompt}>
                      <Text style={styles.cameraLabel}>
                        {stagedPhotos.length > 0 ? `Scan ${stagedPhotos.length} photo${stagedPhotos.length === 1 ? '' : 's'}` : 'Tap to scan'}
                      </Text>
                      <View style={styles.cameraActions}>
                        <View style={styles.cameraActionSlot} />
                        <BlurView intensity={50} tint="light" style={styles.shutterBlur}>
                          {stagedPhotos.length > 0 ? (
                            <Pressable
                              style={({ pressed }) => [styles.shutterRing, pressed && styles.cameraPressed]}
                              onPress={handleScanStaged}
                              accessibilityLabel={`Scan ${stagedPhotos.length} photos`}
                            >
                              <AppIcon name="search" size={26} color={theme.colors.white} />
                            </Pressable>
                          ) : (
                            <View style={styles.shutterRing}>
                              <AppIcon name="camera" size={26} color={theme.colors.white} />
                            </View>
                          )}
                        </BlurView>
                        <View style={styles.cameraActionSlot}>
                          {Platform.OS !== 'web' && (
                            <BlurView intensity={40} tint="dark" style={styles.uploadBtnBlur}>
                              <Pressable
                                style={({ pressed }) => [styles.uploadIconBtn, pressed && styles.cameraPressed]}
                                onPress={handlePickFromLibrary}
                                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
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
          {stagedPhotos.length > 0 && !cameraActive && !scanning && !result && (
            <View style={styles.stagedStripOverlay}>
              {stagedPhotos.map((uri, i) => (
                <View key={`${uri}-${i}`} style={styles.stagedThumb}>
                  <Image source={{ uri }} style={styles.stagedThumbImg} resizeMode="cover" />
                  {!result && (
                    <Pressable
                      style={styles.stagedThumbRemove}
                      onPress={() => handleRemoveStagedPhoto(i)}
                      hitSlop={6}
                    >
                      <AppIcon name="close-circle" size={18} color={theme.colors.white} />
                    </Pressable>
                  )}
                </View>
              ))}

              {!result && (
                <BlurView intensity={40} tint="dark" style={styles.stagedClearBlur}>
                  <Pressable
                    style={({ pressed }) => [styles.stagedClearBtn, pressed && styles.cameraPressed]}
                    onPress={clearResultAndPhoto}
                    hitSlop={6}
                  >
                    <AppIcon name="close" size={18} color={theme.colors.white} />
                  </Pressable>
                </BlurView>
              )}
            </View>
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
            onNameChange={(name) => setResult((prev) => prev ? { ...prev, name } : null)}
            onConfirmHandmade={handleConfirmHandmade}
            rescanningHandmade={rescanningHandmade}
            onRescanWrong={handleRescanWrong}
            rescanningWrong={rescanningWrong}
            onRefreshUpcycle={handleRefreshUpcycle}
            refreshingUpcycle={refreshingUpcycle}
            customDismissed={promptCustomDismissed}
            onDismissCustom={() => setPromptCustomDismissed(true)}
            wrongScanDismissed={promptWrongScanDismissed}
            onDismissWrongScan={() => setPromptWrongScanDismissed(true)}
            theme={theme}
            styles={scanStyles}
          />
        )}

        {!result && savedForLater.length === 0 && recents.length === 0 && (
          <Text style={styles.emptyNudge}>Scan an item to see it here</Text>
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
                      <Image source={{ uri: item.photoUri }} style={styles.recentImg} resizeMode="cover" />
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
                  {item.img ? (
                    <Image source={{ uri: item.img }} style={styles.recentImg} resizeMode="cover" />
                  ) : (
                    <View style={styles.recentImgPlaceholder}>
                      <AppIcon name="camera-outline" size={22} color={theme.colors.mauve} />
                    </View>
                  )}
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
                    <Image source={{ uri: candidate.img }} style={styles.duplicateThumb} resizeMode="cover" />
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
      <PaywallModal visible={paywallVisible} onClose={() => setPaywallVisible(false)} />
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
    borderRadius: 9999,
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
  cameraOverlayIconBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
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
  cameraBgWrapHandmade: {
    borderWidth: 2,
    borderColor: theme.colors.terra,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
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
    backgroundColor: theme.colors.overlay,
    borderRadius: 24,
  },
  cancelPill: {
    borderRadius: 9999,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: theme.colors.overlayWhiteMid,
  },
  clearBtnBlur: {
    position: 'absolute',
    bottom: 16,
    alignSelf: 'center',
    borderRadius: 9999,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: theme.colors.overlayWhiteMid,
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
  stagedCounterPos: {
    position: 'absolute',
    top: 16,
    left: 16,
    zIndex: 10,
  },
  stagedCounterInner: {
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  stagedCounterText: {
    ...theme.typography.caption,
    fontWeight: '700',
    color: theme.colors.white,
  },
  stagedStripCamera: {
    position: 'absolute',
    bottom: 90,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    zIndex: 10,
  },
  stagedStripOverlay: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    zIndex: 10,
  },
  stagedThumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: theme.colors.overlayWhiteStrong,
  },
  stagedThumbImg: {
    width: '100%',
    height: '100%',
  },
  stagedThumbRemove: {
    position: 'absolute',
    top: 2,
    right: 2,
  },
  stagedAddMore: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: theme.colors.overlayWhiteMid,
    borderStyle: 'dashed' as const,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.overlay,
  },
  stagedClearBlur: {
    borderRadius: 9999,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: theme.colors.overlayWhiteMid,
  },
  stagedClearBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchingWrap: {
    alignItems: 'center',
    gap: 12,
  },
  searchingText: {
    ...theme.typography.body,
    fontWeight: '600',
    color: theme.colors.overlayWhiteStrong,
  },
  scanStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surface,
  },
  scanStatusPillText: {
    ...theme.typography.caption,
    color: theme.colors.terra,
    fontWeight: '600',
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
    borderColor: theme.colors.overlayWhiteMid,
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
    borderColor: theme.colors.overlayWhiteStrong,
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
    color: theme.colors.overlayWhiteStrong,
  },
  emptyNudge: {
    ...theme.typography.caption,
    color: theme.colors.mauve,
    textAlign: 'center' as const,
    paddingTop: 24,
    paddingBottom: 8,
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
  recentImgPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceVariant,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
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
    backgroundColor: theme.colors.overlay,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  duplicateCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.section,
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
