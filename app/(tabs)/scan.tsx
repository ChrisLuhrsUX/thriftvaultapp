import { AppIcon } from '@/components/AppIcon';
import { EmptyState } from '@/components/EmptyState';
import { InlinePromptButton } from '@/components/InlinePromptButton';
import { PaywallModal } from '@/components/PaywallModal';
import { DEFAULT_ITEM_PLACEHOLDER_IMAGE } from '@/constants/seedItems';
import { useInventory } from '@/context/InventoryContext';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { usePurchases } from '@/hooks/usePurchases';
import { useResponsive } from '@/hooks/useResponsive';
import { getRedFlagPresentation, isOverloadError, refreshUpcycleIdeas, rescanAsHandmade, scanWithGemini, type AiTier } from '@/services/gemini';
import type { Theme } from '@/theme';
import type { Item, ItemScanSnapshot, ScanScenario } from '@/types/inventory';
import { getConfidenceColor, getConfidencePresentation } from '@/utils/confidencePresentation';
import { formatMoney } from '@/utils/currency';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  Easing,
  FlatList,
  Linking,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Sentry from '@sentry/react-native';
import { Button } from '@/components/Button';

const SAVED_LATER_KEY = 'tv_saved_later';
const TV_PENDING_SCAN_KEY = 'tv_pending_scan';
type SavedScanItem = ScanScenario & { savedAt: number; photoUri?: string | null; photoUris?: string[]; promptCustomDismissed?: boolean; promptWrongScanDismissed?: boolean; promptRedFlagDismissed?: boolean; redFlagDismissed?: boolean };

/**
 * Session-only snapshot kept on the scan tab while the user rescans before
 * committing to inventory. Carries the full ScanScenario for restoring the
 * result card; the ItemScanSnapshot fields mirror what we'll persist to the
 * Item once Buy & Track / Add to Closet runs.
 */
type SessionSnapshot = ItemScanSnapshot & { scenario: ScanScenario };

const SESSION_SNAPSHOT_CAP = 10;
const SNAPSHOT_CAP = 5;

// Failure modes the scan flow can land in. Drives the inline error card's copy +
// icon. Kept generic on purpose; the user never needs to know which AI provider
// or tier responded (see feedback_no_ai_provider_names memory).
type ScanErrorKind = 'busy' | 'network' | 'unavailable' | 'parse' | 'cap-reached' | 'unknown';

function classifyScanError(err: unknown): ScanErrorKind {
  if (err instanceof Error && err.name === 'ScanCapError') {
    return 'cap-reached';
  }
  const message = err instanceof Error ? err.message : String(err ?? '');
  if (/API\s*(429|503|529)/i.test(message) || /overloaded|high\s*demand|rate[\s-]?limit/i.test(message)) {
    return 'busy';
  }
  if (/network\s*request\s*failed|fetch\s*failed|networkerror|typeerror.*fetch|enotfound|econnreset|etimedout|offline/i.test(message)) {
    return 'network';
  }
  if (/key\s*not\s*configured|all\s*providers|no\s*usable|parse\s*failed|invalid\s*response/i.test(message)) {
    return 'unavailable';
  }
  if (/missing\s*(name|resale)|no\s*item\s*detected|unrecognized|couldn'?t\s*identify/i.test(message)) {
    return 'parse';
  }
  return 'unknown';
}

interface ScanErrorCopy {
  title: string;
  body: string;
  icon: 'alert-circle-outline' | 'cloud-offline-outline' | 'time-outline' | 'eye-off-outline' | 'hourglass-outline';
}

function getScanErrorCopy(kind: ScanErrorKind): ScanErrorCopy {
  switch (kind) {
    case 'busy':
      return {
        title: 'AI is busy',
        body: "It's seeing high traffic right now. Try again in a moment.",
        icon: 'time-outline',
      };
    case 'network':
      return {
        title: 'Lost connection',
        body: 'Check your signal and try again.',
        icon: 'cloud-offline-outline',
      };
    case 'unavailable':
      return {
        title: 'Scan unavailable',
        body: "Couldn't reach the AI. Try again in a moment.",
        icon: 'cloud-offline-outline',
      };
    case 'parse':
      return {
        title: "Couldn't read this item",
        body: 'Try a clearer photo or add another angle.',
        icon: 'eye-off-outline',
      };
    case 'cap-reached':
      return {
        title: 'Daily scan limit reached',
        body: "You've hit today's 100-scan limit. Resets at midnight.",
        icon: 'hourglass-outline',
      };
    default:
      return {
        title: 'Something went wrong',
        body: 'Try again, or clear and try a new photo.',
        icon: 'alert-circle-outline',
      };
  }
}
const MAX_STAGED_PHOTOS = 5;
const OLD_ITEM_DAYS_THRESHOLD = 90;

const RECENTS_COUNT = 7;

function buildSessionSnapshot(scenario: ScanScenario, photos: string[]): SessionSnapshot {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
    sub: scenario.sub ?? '',
    profit: scenario.profit ?? '',
    confidence: scenario.confidence,
    isCustom: scenario.isCustom || false,
    ideas: Array.isArray(scenario.ideas) ? scenario.ideas.slice(0, 3) : [],
    upcycle: Array.isArray(scenario.upcycle) ? scenario.upcycle.slice(0, 3) : [],
    authFlags: Array.isArray(scenario.authFlags) ? scenario.authFlags.slice(0, 3) : [],
    redFlags: Array.isArray(scenario.redFlags) ? scenario.redFlags.slice(0, 3) : [],
    beforeAfterDetected: scenario.beforeAfterDetected === true,
    sourceImageUri: photos[0],
    sourceImageUris: photos.length > 0 ? [...photos] : undefined,
    scenario,
  };
}

function formatSnapshotTime(createdAt: number): string {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return 'Unknown time';
  const datePart = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const timePart = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${datePart} · ${timePart}`;
}

function formatElapsed(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/**
 * Generic garment nouns + filler words filtered out before duplicate-name comparison.
 * Item TYPE is already disambiguated by the category filter, so these tokens are noise:
 * one scan calling a piece a "dress" and another calling it a "skirt" should not
 * tank the similarity score for the same physical item.
 * Colors, brands, eras, and style descriptors are intentionally NOT in this list ,
 * those are the distinguishing signal.
 */
const DUPLICATE_STOP_WORDS = new Set([
  'top', 'tops', 'shirt', 'shirts', 'tshirt', 'tee', 'tees', 'blouse', 'tank', 'camisole', 'cami',
  'pants', 'jeans', 'shorts', 'skirt', 'skirts', 'leggings', 'joggers', 'trousers',
  'jacket', 'jackets', 'coat', 'coats', 'hoodie', 'hoodies', 'sweater', 'sweaters', 'cardigan', 'vest', 'parka', 'blazer', 'pullover',
  'dress', 'dresses', 'gown', 'romper', 'jumpsuit', 'overalls',
  'shoes', 'shoe', 'boots', 'boot', 'sneakers', 'sneaker', 'heels', 'sandals', 'flats',
  'bag', 'bags', 'purse', 'wallet', 'belt', 'hat', 'cap', 'scarf', 'gloves',
  'and', 'with', 'the', 'of', 'in', 'on', 'at', 'for', 'to',
  'vintage', 'retro', 'deadstock', 'og', 'y2k', '2k',
  '90s', '80s', '70s', '60s', '2000s', 'nineties', 'eighties', 'seventies', 'sixties',
  'condition', 'used', 'nwt',
]);

const COLOR_TOKENS = new Set([
  'red','crimson','burgundy','maroon','pink','rose','blush','salmon','coral',
  'orange','peach','rust','brown','tan','beige','cream','ivory','white','offwhite',
  'yellow','mustard','gold','olive','green','sage','mint','teal','turquoise','aqua',
  'blue','navy','denim','indigo','cobalt','royal','periwinkle','purple','lavender',
  'violet','plum','magenta','fuchsia','black','charcoal','grey','gray','silver',
]);

const MULTICOLOR_TOKENS = new Set([
  'multicolor','multi','pastel','neon','striped','stripe','floral','plaid',
  'checkered','check','animal','leopard','zebra','tiedye','rainbow','patchwork',
]);

const BRAND_TOKENS = new Set([
  'nike','adidas','puma','reebok','converse','vans','jordan','newbalance','asics','fila',
  'levis','wrangler','lee','gap','oldnavy','jcrew','bananarepublic','express','zara',
  'hm','uniqlo','forever21','aerie','americaneagle','hollister','abercrombie','madewell',
  'patagonia','northface','tnf','columbia','carhartt','dickies','arcteryx','lululemon','athleta',
  'gucci','prada','louisvuitton','lv','coach','michaelkors','toryburch','katespade',
  'ralphlauren','poloralphlauren','tommyhilfiger','calvinklein','dkny','versace','burberry',
  'champion','kappa','supreme','stussy','obey','huf','bape',
]);

const MATERIAL_TOKENS = new Set([
  'leather','suede','denim','cotton','wool','cashmere','silk','satin','linen',
  'velvet','corduroy','flannel','fleece','rayon','polyester','nylon',
  'mesh','knit','crochet','lace','sequin','beaded','embroidered',
]);

type TokenClass = 'brand' | 'color' | 'multicolor' | 'material' | 'generic';
const TOKEN_WEIGHTS: Record<TokenClass, number> = {
  brand: 3.0, color: 2.0, material: 1.5, multicolor: 1.0, generic: 1.0,
};
const DUPLICATE_SCORE_THRESHOLD = 0.60;
const DUPLICATE_BORDERLINE_MIN = 0.40;
const SNAPSHOT_LOOKBACK = 5;

function classifyToken(t: string): TokenClass {
  if (BRAND_TOKENS.has(t)) return 'brand';
  if (COLOR_TOKENS.has(t)) return 'color';
  if (MULTICOLOR_TOKENS.has(t)) return 'multicolor';
  if (MATERIAL_TOKENS.has(t)) return 'material';
  return 'generic';
}

const toastForCorrection = (c: 'lower' | 'higher'): string =>
  c === 'lower' ? 'AI lowered the price' : 'AI raised the price';

const SCAN_BG_SOURCE = require('@/assets/logo/thriftvault_logo.png');

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
  redFlagPromptDismissed,
  redFlagDismissed,
  onConfirmRedFlag,
  onMarkRedFlagFalseAlarm,
  historyCount,
  onShowHistory,
  onClearScan,
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
  redFlagPromptDismissed: boolean;
  redFlagDismissed: boolean;
  onConfirmRedFlag: () => void;
  onMarkRedFlagFalseAlarm: () => void;
  historyCount: number;
  onShowHistory: () => void;
  onClearScan: () => void;
  theme: Theme;
  styles: ReturnType<typeof createScanStyles>;
}) {
  const c = scenario.confidence;
  const confPresentation =
    c === 'low' || c === 'medium' || c === 'high' ? getConfidencePresentation(c, theme) : null;

  const hasRedFlags = !!(scenario.redFlags && scenario.redFlags.length > 0);
  const redFlagBannerActive = hasRedFlags && !redFlagDismissed;
  const redFlagPresentation = useMemo(() => getRedFlagPresentation(scenario.redFlags), [scenario.redFlags]);
  const isVerificationFlags = redFlagPresentation.kind === 'verification';
  const redFlagAccent = isVerificationFlags ? theme.colors.vintageBlueDark : theme.colors.loss;
  const redFlagHeaderLabel = redFlagPresentation.header;
  const redFlagSubtitleLabel = redFlagPresentation.subtext;
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
      {!rescanningHandmade && (scenario.isCustom || scenario.beforeAfterDetected) && (
        <View style={styles.topPillRow}>
          {scenario.isCustom && (
            <View style={styles.customBanner}>
              <AppIcon name="brush-outline" size={14} color={theme.colors.terra} />
              <Text style={styles.customBannerText}>Handmade</Text>
            </View>
          )}
          {scenario.beforeAfterDetected && (
            <View style={styles.customBanner}>
              <AppIcon name="swap-horizontal-outline" size={14} color={theme.colors.terra} />
              <Text style={styles.customBannerText}>Before / After</Text>
            </View>
          )}
        </View>
      )}
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
      {hasRedFlags && !redFlagDismissed && (
        <View style={styles.redFlagSection}>
          <View style={styles.redFlagHeader}>
            <AppIcon name="flag" size={15} color={redFlagAccent} />
            <Text style={[styles.redFlagHeaderText, { color: redFlagAccent }]}>{redFlagHeaderLabel}</Text>
          </View>
          <Text style={[styles.redFlagSubtitle, { color: redFlagAccent }]}>{redFlagSubtitleLabel}</Text>
          {scenario.redFlags!.filter(f => f !== 'stock-photo').map((flag, i) => (
            <View key={i} style={styles.redFlagRow}>
              <View style={[styles.redFlagDot, { backgroundColor: redFlagAccent }]} />
              <Text style={styles.redFlagText}>{flag}</Text>
            </View>
          ))}
          {!redFlagPromptDismissed && (
            <View style={styles.redFlagPromptRow}>
              {isVerificationFlags ? (
                <>
                  <View style={{ flex: 1 }} />
                  <Pressable
                    style={({ pressed }) => [styles.redFlagNo, pressed && { opacity: theme.pressedOpacity.subtle }]}
                    onPress={onMarkRedFlagFalseAlarm}
                    hitSlop={12}
                    accessibilityLabel="Got it"
                    accessibilityRole="button"
                  >
                    <Text style={[styles.redFlagNoText, { color: redFlagAccent }]}>Got it</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={styles.redFlagPromptText}>{redFlagPresentation.promptText}</Text>
                  <Pressable
                    style={({ pressed }) => [styles.redFlagYes, pressed && { opacity: theme.pressedOpacity.primary }]}
                    onPress={onConfirmRedFlag}
                    hitSlop={12}
                    accessibilityLabel={redFlagPresentation.yesAccessibilityLabel}
                    accessibilityRole="button"
                  >
                    <Text style={styles.redFlagYesText}>Yes</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.redFlagNo, pressed && { opacity: theme.pressedOpacity.subtle }]}
                    onPress={onMarkRedFlagFalseAlarm}
                    hitSlop={12}
                    accessibilityLabel={redFlagPresentation.noAccessibilityLabel}
                    accessibilityRole="button"
                  >
                    <Text style={styles.redFlagNoText}>No</Text>
                  </Pressable>
                </>
              )}
            </View>
          )}
        </View>
      )}
<View style={styles.pillRow}>
        {rescanningHandmade ? (
          <View style={styles.handmadePromptRow}>
            <ActivityIndicator size="small" color={theme.colors.terra} />
            <Text style={styles.handmadePromptText}>Updating scan...</Text>
          </View>
        ) : !scenario.isCustom && !customDismissed && !redFlagBannerActive ? (
          <View style={styles.handmadePromptRow}>
            <AppIcon name="brush-outline" size={14} color={theme.colors.mauve} />
            <Text style={styles.handmadePromptText}>Is this handmade?</Text>
            <InlinePromptButton
              label="Yes"
              variant="accent"
              onPress={onConfirmHandmade}
              accessibilityLabel="Yes, this is handmade"
            />
            <InlinePromptButton
              label="No"
              variant="muted"
              onPress={onDismissCustom}
              accessibilityLabel="No, not handmade"
            />
          </View>
        ) : null}
        {rescanningWrong ? (
          <View style={styles.handmadePromptRow}>
            <ActivityIndicator size="small" color={theme.colors.vintageBlueDark} />
            <Text style={styles.handmadePromptText}>Rescanning...</Text>
          </View>
        ) : !wrongScanDismissed && !redFlagBannerActive && (
          <View style={styles.handmadePromptRow}>
            <AppIcon name="alert-circle-outline" size={14} color={theme.colors.mauve} />
            <Text style={styles.handmadePromptText}>Is this scan wrong?</Text>
            <InlinePromptButton
              label="Yes"
              variant="accent"
              onPress={onRescanWrong}
              accessibilityLabel="Yes, rescan this item"
            />
            <InlinePromptButton
              label="No"
              variant="muted"
              onPress={onDismissWrongScan}
              accessibilityLabel="No, scan is correct"
            />
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
          <Pressable onPress={handleCopyIdeas} hitSlop={8} style={({ pressed }) => pressed && { opacity: theme.pressedOpacity.subtle }} accessibilityLabel="Copy all suggestions">
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
            accessibilityLabel="Verify authenticity"
            accessibilityRole="button"
            accessibilityState={{ expanded: authExpanded }}
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
                Get it professionally authenticated first. These estimates are for personal reference only, not an authenticity guarantee.
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
      {historyCount >= 2 && (
        <Pressable
          style={({ pressed }) => [styles.historyBtn, pressed && styles.btnPressed]}
          onPress={onShowHistory}
          accessibilityLabel="View scan history"
          accessibilityRole="button"
        >
          <AppIcon name="time-outline" size={14} color={theme.colors.vintageBlueDark} />
          <Text style={styles.historyBtnText}>Scan history</Text>
          <AppIcon name="chevron-forward" size={14} color={theme.colors.vintageBlueDark} />
        </Pressable>
      )}
      {scenario.upcycle && scenario.upcycle.length > 0 && (
        <View style={styles.upcycleSection}>
          <Pressable
            style={styles.upcycleHeader}
            onPress={() => setUpcycleExpanded((v) => !v)}
            hitSlop={12}
            accessibilityLabel="Upcycle ideas"
            accessibilityRole="button"
            accessibilityState={{ expanded: upcycleExpanded }}
          >
            <AppIcon name="color-palette-outline" size={15} color={theme.colors.terra} />
            <Text style={styles.upcycleHeaderText}>Upcycle ideas</Text>
            {upcycleExpanded && (
              <Pressable onPress={handleCopyUpcycle} hitSlop={8} style={({ pressed }) => pressed && { opacity: theme.pressedOpacity.subtle }} accessibilityLabel="Copy upcycle ideas">
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
            <>
              <View style={styles.upcycleRows}>
                {scenario.upcycle.map((tip, i) => (
                  <View key={i} style={styles.upcycleRow}>
                    <View style={styles.upcycleDot} />
                    <Text style={styles.upcycleText} selectable>{tip}</Text>
                  </View>
                ))}
              </View>
              <Pressable
                onPress={onRefreshUpcycle}
                disabled={refreshingUpcycle}
                hitSlop={8}
                style={({ pressed }) => [styles.upcycleRegenerate, pressed && { opacity: theme.pressedOpacity.subtle }]}
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
            </>
          )}
        </View>
      )}
      <Pressable
        style={({ pressed }) => [styles.deleteScanBtn, pressed && { opacity: theme.pressedOpacity.primary }]}
        onPress={onClearScan}
        hitSlop={8}
        accessibilityLabel="Delete scan"
        accessibilityRole="button"
      >
        <AppIcon name="trash-outline" size={14} color={theme.colors.terra} />
        <Text style={styles.deleteScanBtnText}>Delete scan</Text>
      </Pressable>
      <View style={styles.resultActions}>
        <Pressable
          style={({ pressed }) => [styles.btnPrimary, pressed && styles.btnPressed]}
          onPress={onBuyAndTrack}
          accessibilityLabel="Buy and track this item"
          accessibilityRole="button"
        >
          <Text style={styles.btnPrimaryText}>Buy & Track</Text>
        </Pressable>
        <View style={styles.resultActionsRow}>
          <Pressable
            style={({ pressed }) => [styles.btnSecondary, pressed && styles.btnPressed]}
            onPress={onAddToCloset}
            accessibilityLabel="Add to closet"
            accessibilityRole="button"
          >
            <Text style={styles.btnSecondaryText}>Add to Closet</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.btnSecondary, pressed && styles.btnPressed]}
            onPress={onSaveForLater}
            accessibilityLabel="Save for later"
            accessibilityRole="button"
          >
            <Text style={styles.btnSecondaryText}>Save for Later</Text>
          </Pressable>
        </View>
        <Pressable
          style={({ pressed }) => [styles.btnTertiary, pressed && styles.btnPressed]}
          onPress={onSkip}
          accessibilityLabel="Skip this item"
          accessibilityRole="button"
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
    errorCard: {
      marginHorizontal: 20,
      marginTop: 20,
      padding: theme.spacing.lg,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.surface,
      borderLeftWidth: 3,
      borderLeftColor: theme.colors.terra,
      ...(formMaxWidth ? { maxWidth: formMaxWidth, alignSelf: 'center' as const, width: '100%' as const } : {}),
      ...(theme.shadows.sm ?? {}),
    },
    errorHeader: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.xs,
    },
    errorTitle: {
      ...theme.typography.h2,
      color: theme.colors.charcoal,
      flex: 1,
    },
    errorBody: {
      ...theme.typography.body,
      color: theme.colors.mauve,
      lineHeight: 20,
      marginBottom: theme.spacing.lg,
    },
    errorActions: {
      flexDirection: 'row' as const,
      gap: theme.spacing.sm,
    },
    errorActionBtn: {
      flex: 1,
    },
    resultHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
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
    ideaRows: { gap: 8, marginTop: 12, borderTopWidth: 1, borderTopColor: theme.colors.surfaceVariant, paddingTop: 12, paddingBottom: 12 },
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
      borderTopWidth: 1,
      borderTopColor: theme.colors.surfaceVariant,
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
    redFlagSection: {
      backgroundColor: theme.colors.blush,
      borderRadius: theme.radius.sm,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      marginTop: theme.spacing.md,
      gap: 6,
    },
    redFlagHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    redFlagHeaderText: {
      ...theme.typography.caption,
      color: theme.colors.loss,
      fontWeight: '700',
      flex: 1,
    },
    redFlagSubtitle: {
      ...theme.typography.caption,
      color: theme.colors.loss,
      lineHeight: 18,
    },
    redFlagRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      paddingLeft: 2,
    },
    redFlagDot: {
      width: 5,
      height: 5,
      borderRadius: 3,
      backgroundColor: theme.colors.loss,
      marginTop: 6,
    },
    redFlagText: {
      ...theme.typography.bodySmall,
      color: theme.colors.charcoal,
      flex: 1,
      lineHeight: 20,
    },
    redFlagPromptRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 6,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: theme.colors.surfaceVariant,
    },
    redFlagPromptText: {
      ...theme.typography.caption,
      color: theme.colors.loss,
      flex: 1,
    },
    redFlagYes: {
      justifyContent: 'center',
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.surface,
    },
    redFlagYesText: {
      ...theme.typography.caption,
      fontWeight: '600',
      color: theme.colors.loss,
    },
    redFlagNo: {
      justifyContent: 'center',
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.surface,
    },
    redFlagNoText: {
      ...theme.typography.caption,
      fontWeight: '600',
      color: theme.colors.mauve,
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
    topPillRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 10,
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
    historyBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderTopWidth: 1,
      borderTopColor: theme.colors.surfaceVariant,
      paddingVertical: theme.spacing.sm,
      minHeight: theme.minTouchTargetSize,
    },
    historyBtnText: {
      ...theme.typography.caption,
      color: theme.colors.vintageBlueDark,
      fontWeight: '600',
      flex: 1,
    },
    deleteScanBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderTopWidth: 1,
      borderTopColor: theme.colors.surfaceVariant,
      paddingVertical: theme.spacing.sm,
      minHeight: theme.minTouchTargetSize,
    },
    deleteScanBtnText: {
      ...theme.typography.caption,
      color: theme.colors.terra,
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
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  useEffect(() => {
    if (!scanning) return;
    const start = Date.now();
    setElapsedSeconds(0);
    const id = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [scanning]);
  const [scanStatus, setScanStatus] = useState<string | null>(null);
  const [result, setResult] = useState<ScanScenario | null>(null);
  const [scanError, setScanError] = useState<ScanErrorKind | null>(null);
  // VoiceOver doesn't read accessibilityLiveRegion (Android-only); fire an explicit
  // announcement when an error first appears so iOS screen reader users hear it.
  useEffect(() => {
    if (!scanError || Platform.OS === 'web') return;
    const copy = getScanErrorCopy(scanError);
    AccessibilityInfo.announceForAccessibility(`${copy.title}. ${copy.body}`);
  }, [scanError]);
  const [stagedPhotos, setStagedPhotos] = useState<string[]>([]);
  const [placeholderImageUri, setPlaceholderImageUri] = useState<string | null>(null);
  const [savedForLater, setSavedForLater] = useState<SavedScanItem[]>([]);
  const [duplicateChoiceVisible, setDuplicateChoiceVisible] = useState(false);
  const [pendingIntent, setPendingIntent] = useState<'flip' | 'closet' | null>(null);
  const [duplicateCandidates, setDuplicateCandidates] = useState<Item[]>([]);
  const [duplicatePickerVisible, setDuplicatePickerVisible] = useState(false);
  const [rescanningHandmade, setRescanningHandmade] = useState(false);
  const [rescanningWrong, setRescanningWrong] = useState(false);
  const [photoViewerVisible, setPhotoViewerVisible] = useState(false);
  const [refreshingUpcycle, setRefreshingUpcycle] = useState(false);
  const [promptCustomDismissed, setPromptCustomDismissed] = useState(false);
  const [promptWrongScanDismissed, setPromptWrongScanDismissed] = useState(false);
  const [promptRedFlagDismissed, setPromptRedFlagDismissed] = useState(false);
  const [redFlagDismissed, setRedFlagDismissed] = useState(false);
  const [redFlagDismissedIds, setRedFlagDismissedIds] = useState<Set<number>>(() => new Set());
  const [sessionSnapshots, setSessionSnapshots] = useState<SessionSnapshot[]>([]);
  const [activeSessionSnapshotId, setActiveSessionSnapshotId] = useState<string | null>(null);
  const [scanHistoryVisible, setScanHistoryVisible] = useState(false);
  const historySheetTranslateY = useRef(new Animated.Value(700)).current;
  const scrollRef = useRef<ScrollView>(null);
  const cameraRef = useRef<{ takePictureAsync: (opts?: { quality?: number }) => Promise<{ uri: string }> } | null>(null);
  const scanningRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const appStateRef = useRef(AppState.currentState);
  const pendingRetryRef = useRef(false);
  // Latest result captured for async callbacks that don't list `result` in deps
  // (handleConfirmHandmade), avoids stale closure when computing rescan merges.
  const resultRef = useRef<ScanScenario | null>(null);
  const { isTablet, isDesktop, hPad, headerHPad, formMaxWidth } = useResponsive();
  const { width: screenWidth } = useWindowDimensions();
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

  useEffect(() => { resultRef.current = result; }, [result]);

  const dismissHistorySheet = useCallback(() => {
    Animated.timing(historySheetTranslateY, {
      toValue: 700,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      historySheetTranslateY.setValue(700);
      setScanHistoryVisible(false);
    });
  }, [historySheetTranslateY]);

  useEffect(() => {
    if (scanHistoryVisible) {
      historySheetTranslateY.setValue(700);
      Animated.spring(historySheetTranslateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 55,
        friction: 11,
      }).start();
    }
  }, [scanHistoryVisible, historySheetTranslateY]);

  const historySheetPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_, g) => {
          if (g.dy > 0) historySheetTranslateY.setValue(g.dy);
        },
        onPanResponderRelease: (_, g) => {
          if (g.dy > 100 || g.vy > 0.5) {
            dismissHistorySheet();
          } else {
            Animated.spring(historySheetTranslateY, {
              toValue: 0,
              useNativeDriver: true,
              tension: 80,
              friction: 12,
            }).start();
          }
        },
      }),
    [historySheetTranslateY, dismissHistorySheet]
  );

  const switchActiveSessionSnapshot = useCallback((snapshotId: string) => {
    const snap = sessionSnapshots.find(s => s.id === snapshotId);
    if (!snap) return;
    Haptics.selectionAsync();
    setResult(snap.scenario);
    setActiveSessionSnapshotId(snapshotId);
    if (Platform.OS !== 'web') {
      AccessibilityInfo.announceForAccessibility(
        `Loaded scan: ${snap.scenario?.name ?? 'item'}${snap.confidence ? `, ${snap.confidence} confidence` : ''}`
      );
    }
    dismissHistorySheet();
  }, [sessionSnapshots, dismissHistorySheet]);

  const sessionSnapshotsRef = useRef(sessionSnapshots);
  const activeSessionSnapshotIdRef = useRef(activeSessionSnapshotId);
  useEffect(() => { sessionSnapshotsRef.current = sessionSnapshots; }, [sessionSnapshots]);
  useEffect(() => { activeSessionSnapshotIdRef.current = activeSessionSnapshotId; }, [activeSessionSnapshotId]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const ids = inventory.map((i) => i.id);
        if (ids.length === 0) {
          if (!cancelled) setRedFlagDismissedIds(new Set());
          return;
        }
        const keys = ids.map((id) => `tv_prompt_dismissed_${id}`);
        try {
          const pairs = await AsyncStorage.multiGet(keys);
          if (cancelled) return;
          const next = new Set<number>();
          for (const [key, raw] of pairs) {
            if (!raw) continue;
            try {
              const flags = JSON.parse(raw) as { redFlagBanner?: boolean };
              if (flags.redFlagBanner) {
                const id = Number(key.slice('tv_prompt_dismissed_'.length));
                if (Number.isFinite(id)) next.add(id);
              }
            } catch { /* ignore */ }
          }
          setRedFlagDismissedIds(next);
        } catch { /* ignore */ }
      })();
      return () => { cancelled = true; };
    }, [inventory])
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
          if (parsed.promptRedFlagDismissed)
            setPromptRedFlagDismissed(true);
          if (parsed.redFlagDismissed)
            setRedFlagDismissed(true);
          if (Array.isArray(parsed.sessionSnapshots) && parsed.sessionSnapshots.length > 0) {
            setSessionSnapshots(parsed.sessionSnapshots);
            setActiveSessionSnapshotId(parsed.activeSessionSnapshotId ?? parsed.sessionSnapshots[0]?.id ?? null);
          } else {
            const snap = buildSessionSnapshot(
              parsed.result,
              Array.isArray(parsed.stagedPhotos) ? parsed.stagedPhotos : [],
            );
            setSessionSnapshots([snap]);
            setActiveSessionSnapshotId(snap.id);
          }
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
        promptRedFlagDismissed,
        redFlagDismissed,
        sessionSnapshots,
        activeSessionSnapshotId,
      }));
    }
  }, [result, stagedPhotos, placeholderImageUri, promptCustomDismissed, promptWrongScanDismissed, promptRedFlagDismissed, redFlagDismissed, sessionSnapshots, activeSessionSnapshotId]);

  const cancelScan = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    pendingRetryRef.current = false;
    setScanning(false);
    scanningRef.current = false;
  }, []);

  const handleScanStaged = useCallback(async () => {
    if (scanningRef.current || stagedPhotos.length === 0) return;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    scanningRef.current = true;
    setResult(null);
    setScanError(null);
    setPromptCustomDismissed(false);
    setPromptWrongScanDismissed(false);
    setPromptRedFlagDismissed(false);
    setRedFlagDismissed(false);
    setScanning(true);
    setCameraActive(false);
    setCameraReady(false);
    const scanStartMs = Date.now();
    let capturedTier: AiTier | null = null;
    const photoCount = stagedPhotos.length;
    try {
      const geminiResult = await scanWithGemini(stagedPhotos, controller.signal, setScanStatus, undefined, (t) => { capturedTier = t; });
      if (controller.signal.aborted) return;
      pendingRetryRef.current = false; // scan succeeded, don't retry on foreground
      setResult(geminiResult);
      const snap = buildSessionSnapshot(geminiResult, stagedPhotos);
      setSessionSnapshots(prev => [snap, ...prev].slice(0, SESSION_SNAPSHOT_CAP));
      setActiveSessionSnapshotId(snap.id);
      Sentry.captureMessage('scan_completed', {
        level: 'info',
        tags: { scope: 'scan', tier: capturedTier ?? 'unknown', multi: photoCount > 1 ? 'multi' : 'single' },
        extra: { duration_ms: Date.now() - scanStartMs, photo_count: photoCount, flow: 'primary' },
      });
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') return;
      // We backgrounded mid-scan, failure is almost always iOS suspending the
      // network. Suppress the error UI; the finally block (or AppState 'active'
      // handler) will fire a seamless retry without resetting the spinner.
      if (pendingRetryRef.current) return;
      if (__DEV__) console.log('[Scan] error:', error);
      const kind = classifyScanError(error);
      setScanError(kind);
      // Production telemetry: capture the full error with classification context
      // so we can tell network noise apart from real outages in Sentry.
      Sentry.captureException(error, {
        tags: { scope: 'scan', scanErrorKind: kind, tier: capturedTier ?? 'none', multi: photoCount > 1 ? 'multi' : 'single' },
        extra: { duration_ms: Date.now() - scanStartMs, photo_count: photoCount, flow: 'primary' },
      });
    } finally {
      scanningRef.current = false;
      abortControllerRef.current = null;
      if (pendingRetryRef.current && appStateRef.current === 'active') {
        // Already foreground, AppState handler skipped retry while scanningRef
        // was true. Fire it from here without touching the scanning UI so the
        // spinner stays continuous.
        pendingRetryRef.current = false;
        queueMicrotask(() => handleScanStagedRef.current());
      } else if (!pendingRetryRef.current) {
        setScanning(false);
        setScanStatus(null);
      }
      // If pendingRetryRef is still true (still backgrounded), leave scanning
      // UI up. AppState 'active' will fire the retry on resume.
    }
  }, [stagedPhotos]);

  // Keep a stable ref so the AppState listener always calls the latest handleScanStaged
  // without needing it in the effect's dependency array.
  const handleScanStagedRef = useRef(handleScanStaged);
  handleScanStagedRef.current = handleScanStaged;

  // Auto-retry scan when app returns to foreground after being backgrounded mid-scan.
  // Effect runs once on mount, refs keep everything up to date without re-subscribing.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      if (next === 'background' && scanningRef.current) {
        // Mark for retry, if the scan doesn't complete before we foreground, retry then.
        // Do NOT abort: iOS allows active fetches to finish in background, so aborting
        // would kill a scan that's about to succeed.
        pendingRetryRef.current = true;
      }
      if (
        prev !== 'active' &&
        next === 'active' &&
        pendingRetryRef.current &&
        !scanningRef.current
      ) {
        // Only fire retry once the original promise has settled (scanningRef
        // false). If it's still in flight, leave the flag set, handleScanStaged's
        // finally block will fire the retry when the original rejects.
        pendingRetryRef.current = false;
        handleScanStagedRef.current();
      }
    });
    return () => sub.remove();
  }, []);

  // Auto-scan once the live camera fills the staging cap. Cancel button stays
  // available during the scan if the user wants to bail out.
  useEffect(() => {
    if (
      cameraActive &&
      stagedPhotos.length >= MAX_STAGED_PHOTOS &&
      !result &&
      !scanningRef.current
    ) {
      handleScanStagedRef.current();
    }
  }, [stagedPhotos.length, cameraActive, result]);

  const handleCapturePhoto = useCallback(async () => {
    if (!__DEV__ && !isPro) { setPaywallVisible(true); return; }
    if (!CAMERA_AVAILABLE || scanning || !cameraReady || scanningRef.current) return;
    if (stagedPhotos.length >= MAX_STAGED_PHOTOS) {
      showToast(`Maximum ${MAX_STAGED_PHOTOS} photos per scan`);
      return;
    }
    try {
      const photo = await cameraRef.current?.takePictureAsync?.({ quality: 0.8 });
      if (!photo?.uri) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setStagedPhotos((prev) => {
        if (prev.length === 0) setPlaceholderImageUri(photo.uri);
        return [...prev, photo.uri];
      });
    } catch {
      showToast("Couldn't capture photo, try again");
    }
  }, [cameraReady, scanning, isPro, showToast, stagedPhotos.length]);

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
      // On denial the persistent denied UI in the cameraBox renders with an
      // Open Settings button, no toast needed (and the toast disappears in
      // 2.6s while the user is still figuring out what just happened).
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
    // Explicit permission check before launching the picker. Without this,
    // a denied user taps "From Library" and gets a silent `canceled: true`
    // back from ImagePicker with no path forward. iOS only prompts once
    // per app lifetime, so on permanent denial we route to system Settings.
    const existing = await ImagePicker.getMediaLibraryPermissionsAsync();
    let granted = existing.granted;
    if (!granted && existing.canAskAgain) {
      const requested = await ImagePicker.requestMediaLibraryPermissionsAsync();
      granted = requested.granted;
    }
    if (!granted) {
      Alert.alert(
        'Photo library access',
        'ThriftVault needs access to your photo library to upload photos for scanning. You can enable it in Settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ],
      );
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
      showToast("Couldn't open photo library");
    }
  }, [showToast, scanning, stagedPhotos.length, isPro, cameraActive]);

  const clearResultAndPhoto = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setResult(null);
    setScanError(null);
    setStagedPhotos([]);
    setPlaceholderImageUri(null);
    setPromptCustomDismissed(false);
    setPromptWrongScanDismissed(false);
    setPromptRedFlagDismissed(false);
    setRedFlagDismissed(false);
    setRescanningHandmade(false);
    setRescanningWrong(false);
    setSessionSnapshots([]);
    setActiveSessionSnapshotId(null);
    AsyncStorage.removeItem(TV_PENDING_SCAN_KEY);
    setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: true }), 50);
  }, []);

  const deleteActiveSessionSnapshot = useCallback(() => {
    Alert.alert('Delete Scan', 'Remove this scan?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          const activeId = activeSessionSnapshotIdRef.current;
          const snapshots = sessionSnapshotsRef.current;
          if (!activeId) {
            clearResultAndPhoto();
            return;
          }
          const remaining = snapshots.filter(s => s.id !== activeId);
          if (remaining.length === 0) {
            setSessionSnapshots([]);
            setActiveSessionSnapshotId(null);
            clearResultAndPhoto();
            return;
          }
          const next = remaining[0];
          setSessionSnapshots(remaining);
          setActiveSessionSnapshotId(next.id);
          setResult(next.scenario);
        },
      },
    ]);
  }, [clearResultAndPhoto]);

  /**
   * Tokenize free text to distinctive words: drop short fillers and generic garment nouns.
   * Reused for both new scan results and existing item names/subs during duplicate matching.
   */
  const tokenizeRich = useCallback((text: string): string[] => {
    return text.toLowerCase()
      .replace(/[^a-z0-9]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 1 && !DUPLICATE_STOP_WORDS.has(w));
  }, []);

  /**
   * Weighted multi-signal duplicate score in [0, 1]. ≥ DUPLICATE_SCORE_THRESHOLD = candidate.
   * Brand/color/material tokens carry more weight than generic descriptors.
   * Color conflicts (no shared color when both sides assert one) get a hard penalty,
   * unless either side is multicolor/floral/striped (those are too noisy to enforce).
   * Sparse-token rescue lets short matched names like "Red T-Shirt"/"Red Cotton Tee" still match.
   * Mines historical scanSnapshots[].sub so AI naming variance across rescans doesn't lose the link.
   */
  const scoreItemAgainstResult = useCallback((item: Item, res: ScanScenario): number => {
    const aTokens = tokenizeRich(`${res.name} ${res.sub ?? ''}`);
    const snapshots = (item.scanSnapshots ?? []).slice(0, SNAPSHOT_LOOKBACK);
    const bTokens = [
      ...tokenizeRich(item.name),
      ...snapshots.flatMap((s) => tokenizeRich(s.sub ?? '')),
    ];
    if (aTokens.length === 0 || bTokens.length === 0) return 0;
    const bSet = new Set(bTokens);

    let matchedWeight = 0;
    let totalWeightA = 0;
    let brandMatch = false;
    let colorMatch = false;
    const matchedTokens = new Set<string>();
    const aColors = new Set<string>();
    const bColors = new Set<string>();
    let hasMulticolor = false;

    for (const t of aTokens) {
      const cls = classifyToken(t);
      const w = TOKEN_WEIGHTS[cls];
      totalWeightA += w;
      if (bSet.has(t)) {
        matchedWeight += w;
        matchedTokens.add(t);
        if (cls === 'brand') brandMatch = true;
        if (cls === 'color') colorMatch = true;
      }
      if (cls === 'color') aColors.add(t);
      if (cls === 'multicolor') hasMulticolor = true;
    }
    for (const t of bTokens) {
      const cls = classifyToken(t);
      if (cls === 'color') bColors.add(t);
      if (cls === 'multicolor') hasMulticolor = true;
    }

    let score = matchedWeight / Math.max(totalWeightA, 1);
    if (brandMatch) score += 0.15;
    if (colorMatch) score += 0.10;

    if (!hasMulticolor && aColors.size > 0 && bColors.size > 0) {
      const anyShared = [...aColors].some((c) => bColors.has(c));
      if (!anyShared) score -= 0.30;
    }

    if (aTokens.length <= 1 && bTokens.length <= 1 && matchedWeight > 0) {
      score = Math.max(score, 0.6);
    }

    // Distinct-match floor: without a brand signal, fewer than 3 matched tokens
    // shouldn't clear DUPLICATE_SCORE_THRESHOLD. Common false-positive shapes are
    // 2-token overlaps like "black cotton" (sweater vs. hoodie), "vintage floral"
    // (maxi vs. sundress), "blue denim" (jacket vs. vest), same color/material
    // family across unrelated items. Brand match is the lone exception since brand
    // identity is uniquely distinctive within a category. Same-photo rescans still
    // catch via the byte-exact image-size fallback, and snapshot mining accumulates
    // vocabulary across rescans so multi-scan unbranded items still merge.
    if (!brandMatch && matchedTokens.size < 3) {
      score = Math.min(score, DUPLICATE_BORDERLINE_MIN);
    }

    return Math.min(Math.max(score, 0), 1);
  }, [tokenizeRich]);

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
    redFlags: Array.isArray(scenario.redFlags) ? scenario.redFlags.slice(0, 3) : [],
    beforeAfterDetected: scenario.beforeAfterDetected === true,
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
    const stagedToPersisted = new Map<string, string>();
    stagedPhotos.forEach((u, i) => {
      const dest = persistedUris[i];
      if (dest) stagedToPersisted.set(u, dest);
    });
    const remap = (uri?: string) => (uri ? stagedToPersisted.get(uri) ?? uri : uri);
    const remapAll = (uris?: string[]) => uris?.map((u) => remap(u) ?? u);
    const itemSnapshots: ItemScanSnapshot[] = sessionSnapshots.length > 0
      // Drop the session-only `scenario` field; persisted snapshot mirrors ItemScanSnapshot exactly.
      ? sessionSnapshots.map(({ scenario: _scenario, ...s }) => ({
          ...s,
          sourceImageUri: remap(s.sourceImageUri),
          sourceImageUris: remapAll(s.sourceImageUris),
        }))
      : [createSnapshot(result, persistedUris.length > 0 ? persistedUris : undefined)];
    const activeSnapId = activeSessionSnapshotId && itemSnapshots.some(s => s.id === activeSessionSnapshotId)
      ? activeSessionSnapshotId
      : itemSnapshots[0]?.id;
    // sessionSnapshots is newest-first (handleScanStaged + rescans prepend), so the
    // oldest entry is the original scan. For saved-for-later items openSavedItem
    // pins that snapshot's createdAt to savedAt, so item.date reflects the original
    // scan and doesn't drift forward when the user later commits to flips/closet.
    const originalScanAt = itemSnapshots[itemSnapshots.length - 1]?.createdAt ?? Date.now();
    const newItem: Item = {
      id,
      name: result.name,
      cat: result.category ?? 'tops',
      paid,
      resale,
      status: 'unlisted',
      date: new Date(originalScanAt).toLocaleDateString('en-US', {
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
      scanSnapshots: itemSnapshots,
      activeScanSnapshotId: activeSnapId,
    };
    addItem(newItem);
    if (promptCustomDismissed || promptWrongScanDismissed || promptRedFlagDismissed || redFlagDismissed) {
      // Await before navigating: detail.tsx reads this key on mount, and a fire-and-forget
      // setItem can lose the race against detail's getItem despite AsyncStorage's queue.
      await AsyncStorage.setItem(`tv_prompt_dismissed_${id}`, JSON.stringify({
        handmade: promptCustomDismissed,
        wrongScan: promptWrongScanDismissed,
        redFlagPrompt: promptRedFlagDismissed,
        redFlagBanner: redFlagDismissed,
      }));
    }
    clearResultAndPhoto();
    router.push({ pathname: '/detail', params: { itemId: String(id), fromScan: '1' } });
  }, [result, persistPhotos, stagedPhotos, createSnapshot, addItem, sessionSnapshots, activeSessionSnapshotId, promptCustomDismissed, promptWrongScanDismissed, promptRedFlagDismissed, redFlagDismissed, clearResultAndPhoto, router]);

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
    // Map staged URIs the session referenced to their post-persist destinations.
    // uniqueNewStaged → persistedNew by index; deduped staged URIs reuse existing photos.
    const stagedToFinal = new Map<string, string>();
    uniqueNewStaged.forEach((u, i) => {
      const dest = persistedNew[i];
      if (dest) stagedToFinal.set(u, dest);
    });
    for (const u of stagedPhotos) {
      if (stagedToFinal.has(u)) continue;
      let size: number | null = null;
      try {
        const info = await FileSystem.getInfoAsync(u);
        if (info.exists && typeof (info as any).size === 'number') size = (info as any).size;
      } catch { /* ignore */ }
      const reused = size != null ? sizeToExistingUri.get(size) : undefined;
      if (reused) stagedToFinal.set(u, reused);
    }
    const remap = (uri?: string) => (uri ? stagedToFinal.get(uri) ?? uri : uri);
    const remapAll = (uris?: string[]) => uris?.map((u) => remap(u) ?? u);
    const newSnapshots: ItemScanSnapshot[] = sessionSnapshots.length > 0
      ? sessionSnapshots.map(({ scenario: _scenario, ...s }) => ({
          ...s,
          sourceImageUri: remap(s.sourceImageUri),
          sourceImageUris: remapAll(s.sourceImageUris),
        }))
      : [createSnapshot(result, snapshotUris.length > 0 ? snapshotUris : undefined)];
    const nextSnapshots = [...newSnapshots, ...(target.scanSnapshots ?? [])].slice(0, SNAPSHOT_CAP);
    const activeId = activeSessionSnapshotId && nextSnapshots.some(s => s.id === activeSessionSnapshotId)
      ? activeSessionSnapshotId
      : newSnapshots[0]?.id;
    const newResale = result.suggestedResale ?? 0;
    const catFromScan = result.category && result.category !== 'other' ? { cat: result.category } : {};
    const fieldUpdates = {
      name: result.name,
      ...(pendingIntent !== 'closet' && newResale > 0 ? { resale: newResale } : {}),
      ...(pendingIntent === 'closet' ? { intent: 'closet' as const, resale: 0 } : {}),
      ...catFromScan,
    };
    updateItem(target.id, {
      img: persistedNew[0] || target.img,
      photos: mergedPhotos.length > 0 ? mergedPhotos : target.photos,
      scanSnapshots: nextSnapshots,
      activeScanSnapshotId: activeId,
      updatedAt: Date.now(),
      ...fieldUpdates,
    });
    if (promptCustomDismissed || promptWrongScanDismissed || promptRedFlagDismissed || redFlagDismissed) {
      // Merge scan-card dismissals into existing per-item flags so a No tap on scan
      // doesn't get clobbered by stale flags on the existing item.
      const key = `tv_prompt_dismissed_${target.id}`;
      let existing: { handmade?: boolean; wrongScan?: boolean; redFlagPrompt?: boolean; redFlagBanner?: boolean } = {};
      try {
        const raw = await AsyncStorage.getItem(key);
        if (raw) existing = JSON.parse(raw);
      } catch { /* ignore */ }
      await AsyncStorage.setItem(key, JSON.stringify({
        handmade: existing.handmade || promptCustomDismissed,
        wrongScan: existing.wrongScan || promptWrongScanDismissed,
        redFlagPrompt: existing.redFlagPrompt || promptRedFlagDismissed,
        redFlagBanner: existing.redFlagBanner || redFlagDismissed,
      }));
    }
    setDuplicateChoiceVisible(false);
    setDuplicatePickerVisible(false);
    setPendingIntent(null);
    setDuplicateCandidates([]);
    clearResultAndPhoto();
    router.push({ pathname: '/detail', params: { itemId: String(target.id), fromScan: '1' } });
  }, [result, persistPhotos, stagedPhotos, createSnapshot, updateItem, sessionSnapshots, activeSessionSnapshotId, promptCustomDismissed, promptWrongScanDismissed, promptRedFlagDismissed, redFlagDismissed, clearResultAndPhoto, router, pendingIntent]);

  const isOldOrSold = useCallback((item: Item) => {
    if (item.status === 'sold') return true;
    const itemDate = new Date(item.date);
    if (Number.isNaN(itemDate.getTime())) return false;
    const ageMs = Date.now() - itemDate.getTime();
    return ageMs > OLD_ITEM_DAYS_THRESHOLD * 24 * 60 * 60 * 1000;
  }, []);

  const handleDuplicateChoice = useCallback(async (intent: 'flip' | 'closet') => {
    if (!result) return;

    const stagedSizes = new Set<number>();
    await Promise.all(stagedPhotos.map(async (uri) => {
      try {
        const info = await FileSystem.getInfoAsync(uri);
        if (info.exists && typeof (info as any).size === 'number') {
          stagedSizes.add((info as any).size);
        }
      } catch { /* ignore */ }
    }));

    const scored: { item: Item; score: number }[] = [];
    const sizeCheckQueue: Item[] = [];
    for (const item of inventory) {
      if (item.status === 'sold') continue;
      const score = scoreItemAgainstResult(item, result);
      const categoryOk = !!result.category && item.cat === result.category;
      if (categoryOk && score >= DUPLICATE_SCORE_THRESHOLD) {
        scored.push({ item, score });
        continue;
      }
      if (stagedSizes.size > 0 && (categoryOk || score >= DUPLICATE_BORDERLINE_MIN)) {
        sizeCheckQueue.push(item);
      }
    }

    if (stagedSizes.size > 0 && sizeCheckQueue.length > 0) {
      const CHUNK = 20;
      for (let i = 0; i < sizeCheckQueue.length; i += CHUNK) {
        const chunk = sizeCheckQueue.slice(i, i + CHUNK);
        await Promise.all(chunk.map(async (item) => {
          const snapUri = item.scanSnapshots?.[0]?.sourceImageUri;
          if (!snapUri) return;
          try {
            const info = await FileSystem.getInfoAsync(snapUri);
            if (info.exists && typeof (info as any).size === 'number' && stagedSizes.has((info as any).size)) {
              scored.push({ item, score: 0.99 });
            }
          } catch { /* ignore */ }
        }));
      }
    }

    if (scored.length === 0) {
      void createItemFromScan(intent);
      return;
    }

    const seen = new Set<number>();
    const candidates = scored
      .sort((a, b) => b.score - a.score)
      .filter(({ item }) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      })
      .map(({ item }) => item);

    setPendingIntent(intent);
    setDuplicateCandidates(candidates);
    setDuplicateChoiceVisible(true);
  }, [result, stagedPhotos, scoreItemAgainstResult, inventory, createItemFromScan]);

  const handleBuyAndTrack = useCallback(async () => {
    if (!result) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await handleDuplicateChoice('flip');
  }, [result, handleDuplicateChoice]);

  const handleAddToCloset = useCallback(async () => {
    if (!result) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await handleDuplicateChoice('closet');
  }, [result, handleDuplicateChoice]);

  const handleSkip = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    showToast('Skipped');
    clearResultAndPhoto();
  }, [showToast, clearResultAndPhoto]);

  const handleConfirmHandmade = useCallback(async () => {
    if (stagedPhotos.length === 0 || rescanningHandmade) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setRescanningHandmade(true);
    const scanStartMs = Date.now();
    let capturedTier: AiTier | null = null;
    const photoCount = stagedPhotos.length;
    try {
      const updated = await rescanAsHandmade(stagedPhotos, controller.signal, undefined, (t) => { capturedTier = t; });
      if (controller.signal.aborted) return;
      const prev = resultRef.current;
      if (!prev) return;
      const merged: ScanScenario = {
        ...updated,
        isCustom: true,
        beforeAfterDetected: updated.beforeAfterDetected === true || prev.beforeAfterDetected === true,
      };
      setResult(merged);
      const snap = buildSessionSnapshot(merged, stagedPhotos);
      setSessionSnapshots(s => [snap, ...s].slice(0, SESSION_SNAPSHOT_CAP));
      setActiveSessionSnapshotId(snap.id);
      Sentry.captureMessage('scan_completed', {
        level: 'info',
        tags: { scope: 'scan', tier: capturedTier ?? 'unknown', multi: photoCount > 1 ? 'multi' : 'single' },
        extra: { duration_ms: Date.now() - scanStartMs, photo_count: photoCount, flow: 'rescan_handmade' },
      });
    } catch (err) {
      if (__DEV__) console.log('[Handmade rescan] error:', err);
      const capHit = err instanceof Error && err.name === 'ScanCapError';
      showToast(capHit ? (err as Error).message : isOverloadError(err) ? 'AI is busy, try again in a moment' : "Couldn't rescan, try again");
    } finally {
      setRescanningHandmade(false);
    }
  }, [stagedPhotos, rescanningHandmade, showToast]);

  const handleRescanWrong = useCallback(async () => {
    if (stagedPhotos.length === 0 || rescanningWrong) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setRescanningWrong(true);
    const scanStartMs = Date.now();
    let capturedTier: AiTier | null = null;
    const photoCount = stagedPhotos.length;
    try {
      const wasHandmade = result?.isCustom === true;
      const prior = result ?? undefined;
      const captureTier = (t: AiTier) => { capturedTier = t; };
      const updated = wasHandmade
        ? await rescanAsHandmade(stagedPhotos, controller.signal, prior, captureTier)
        : await scanWithGemini(stagedPhotos, controller.signal, undefined, prior, captureTier);
      if (controller.signal.aborted) return;
      if (resultRef.current === null) return;
      const merged: ScanScenario = { ...updated, isCustom: wasHandmade || updated.isCustom };
      setResult(merged);
      const snap = buildSessionSnapshot(merged, stagedPhotos);
      setSessionSnapshots(s => [snap, ...s].slice(0, SESSION_SNAPSHOT_CAP));
      setActiveSessionSnapshotId(snap.id);
      if (updated.correction) showToast(toastForCorrection(updated.correction));
      Sentry.captureMessage('scan_completed', {
        level: 'info',
        tags: { scope: 'scan', tier: capturedTier ?? 'unknown', multi: photoCount > 1 ? 'multi' : 'single' },
        extra: { duration_ms: Date.now() - scanStartMs, photo_count: photoCount, flow: 'rescan_wrong', was_handmade: wasHandmade },
      });
    } catch (err) {
      if (__DEV__) console.log('[Wrong rescan] error:', err);
      const capHit = err instanceof Error && err.name === 'ScanCapError';
      showToast(capHit ? (err as Error).message : isOverloadError(err) ? 'AI is busy, try again in a moment' : "Couldn't rescan, try again");
    } finally {
      setRescanningWrong(false);
    }
  }, [stagedPhotos, rescanningWrong, result, showToast]);

  const handleRefreshUpcycle = useCallback(async () => {
    const photoUri = stagedPhotos[0];
    if (!photoUri || refreshingUpcycle) return;
    setRefreshingUpcycle(true);
    const scanStartMs = Date.now();
    let capturedTier: AiTier | null = null;
    try {
      const newUpcycle = await refreshUpcycleIdeas(
        photoUri,
        result ? { name: result.name, category: result.category, sub: result.sub } : undefined,
        undefined,
        (t) => { capturedTier = t; },
      );
      setResult((prev) => prev ? { ...prev, upcycle: newUpcycle } : null);
      Sentry.captureMessage('scan_completed', {
        level: 'info',
        tags: { scope: 'scan', tier: capturedTier ?? 'unknown', multi: 'single' },
        extra: { duration_ms: Date.now() - scanStartMs, photo_count: 1, flow: 'upcycle_refresh' },
      });
    } catch (err) {
      showToast(err instanceof Error && err.name === 'ScanCapError' ? err.message : "Couldn't refresh, try again");
    } finally {
      setRefreshingUpcycle(false);
    }
  }, [stagedPhotos, refreshingUpcycle, result, showToast]);

  const handleSaveForLater = useCallback(() => {
    if (!result) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const saved: SavedScanItem = { ...result, savedAt: Date.now(), photoUri: stagedPhotos[0] ?? null, photoUris: stagedPhotos, promptCustomDismissed, promptWrongScanDismissed, promptRedFlagDismissed, redFlagDismissed };
    setSavedForLater((prev) => {
      const next = [...prev, saved];
      persistSavedForLater(next);
      return next;
    });
    showToast('Saved for later');
    clearResultAndPhoto();
  }, [result, stagedPhotos, showToast, clearResultAndPhoto, persistSavedForLater, promptCustomDismissed, promptWrongScanDismissed, promptRedFlagDismissed, redFlagDismissed]);

  const openSavedItem = useCallback((saved: SavedScanItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Cancel any in-flight scan/rescan first, otherwise its setResult lands
    // a moment later and clobbers the saved item we're loading.
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    pendingRetryRef.current = false;
    scanningRef.current = false;
    setScanning(false);
    setScanStatus(null);
    setRescanningHandmade(false);
    setRescanningWrong(false);
    setSavedForLater((prev) => {
      const next = prev.filter((s) => s.savedAt !== saved.savedAt);
      persistSavedForLater(next);
      return next;
    });
    const restoredPhotos = saved.photoUris ?? (saved.photoUri ? [saved.photoUri] : []);
    setStagedPhotos(restoredPhotos);
    setPlaceholderImageUri(restoredPhotos[0] ?? null);
    setResult(saved);
    setPromptCustomDismissed(saved.promptCustomDismissed === true);
    setPromptWrongScanDismissed(saved.promptWrongScanDismissed === true);
    setPromptRedFlagDismissed(saved.promptRedFlagDismissed === true);
    setRedFlagDismissed(saved.redFlagDismissed === true);
    // Pin the restored snapshot's createdAt to the original savedAt so the scan
    // timestamp survives the save-for-later round-trip. Without this, createItemFromScan
    // would later see a "now" timestamp and bump item.date forward.
    const baseSnap = buildSessionSnapshot(saved, restoredPhotos);
    const snap = { ...baseSnap, createdAt: saved.savedAt };
    setSessionSnapshots([snap]);
    setActiveSessionSnapshotId(snap.id);
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
          <View style={styles.headerTitleBlock}>
            <Text style={styles.title} accessibilityRole="header">Scan</Text>
            <Text style={styles.sub}>Find your next flip</Text>
          </View>
          {/* <Text style={styles.versionTag}>ThriftVault · Launching June</Text> */}
        </View>
        <View style={[styles.cameraBoxWrap, result?.redFlags?.length && !redFlagDismissed ? styles.cameraBoxRedFlag : null]}>
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
                accessibilityLabel="Open settings"
                accessibilityRole="button"
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
                {stagedPhotos.length > 0 && (
                  <BlurView intensity={40} tint="dark" style={[styles.cameraOverlayBtnBlur, styles.stagedCounterPos]}>
                    <View style={styles.stagedCounterInner}>
                      <Text style={styles.stagedCounterText}>{stagedPhotos.length}/{MAX_STAGED_PHOTOS}</Text>
                    </View>
                  </BlurView>
                )}
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
                      accessibilityLabel="Take photo"
                      accessibilityRole="button"
                    >
                      {scanning ? (
                        <ActivityIndicator size="small" color={theme.colors.white} />
                      ) : (
                        <AppIcon name="camera" size={28} color={theme.colors.white} />
                      )}
                    </Pressable>
                  </BlurView>
                </View>
                {stagedPhotos.length > 0 && (
                  <BlurView intensity={40} tint="dark" style={[styles.cameraOverlayBtnBlur, styles.cameraOverlayScan]}>
                    <Pressable
                      hitSlop={8}
                      style={({ pressed }) => [styles.cameraOverlayIconBtn, pressed && styles.cameraPressed]}
                      onPress={handleScanStaged}
                      accessibilityLabel={`Scan ${stagedPhotos.length} photo${stagedPhotos.length === 1 ? '' : 's'}`}
                      accessibilityRole="button"
                    >
                      <AppIcon name="search" size={22} color={theme.colors.white} />
                    </Pressable>
                  </BlurView>
                )}
              </View>
            </>
          ) : (
            <Pressable
              style={({ pressed }) => [styles.cameraBgWrap, scanStatus && styles.cameraBgWrapHandmade, pressed && styles.cameraPressed]}
              onPress={result && placeholderImageUri ? () => setPhotoViewerVisible(true) : handleTapToScan}
              disabled={scanning || (!result && stagedPhotos.length > 0)}
            >
              {isDesktop ? (
                <View style={styles.cameraBg}>
                  <Image
                    source={placeholderImageUri ? { uri: placeholderImageUri } : SCAN_BG_SOURCE}
                    style={styles.cameraBgImage}
                    contentFit="contain"
                    cachePolicy="memory-disk"
                  />
                  {!result && <View style={styles.cameraOverlay} />}
                  {!result && (scanning ? (
                    <View style={styles.searchingWrap}>
                      <ActivityIndicator size="large" color={theme.colors.white} />
                      <View style={styles.searchingTextRow}>
                        <Text style={styles.searchingText}>Searching · </Text>
                        <Text style={[styles.searchingText, styles.searchingTimer]}>{formatElapsed(elapsedSeconds)}</Text>
                      </View>
                      {scanStatus && (
                        <View style={styles.scanStatusPill}>
                          <AppIcon name="brush-outline" size={14} color={theme.colors.terra} />
                          <Text style={styles.scanStatusPillText}>{scanStatus}</Text>
                        </View>
                      )}
                      <BlurView intensity={40} tint="dark" style={styles.cancelPill}>
                        <Pressable style={({ pressed }) => [styles.clearBtn, pressed && styles.cameraPressed]} onPress={cancelScan} hitSlop={8} accessibilityLabel="Cancel scan" accessibilityRole="button">
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
                <View style={styles.cameraBg}>
                  <Image
                    source={placeholderImageUri ? { uri: placeholderImageUri } : SCAN_BG_SOURCE}
                    style={styles.cameraBgImage}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                  />
                  {!result && <View style={styles.cameraOverlay} />}
                  {!result && (scanning ? (
                    <View style={styles.searchingWrap}>
                      <ActivityIndicator size="large" color={theme.colors.white} />
                      <View style={styles.searchingTextRow}>
                        <Text style={styles.searchingText}>Searching · </Text>
                        <Text style={[styles.searchingText, styles.searchingTimer]}>{formatElapsed(elapsedSeconds)}</Text>
                      </View>
                      {scanStatus && (
                        <View style={styles.scanStatusPill}>
                          <AppIcon name="brush-outline" size={14} color={theme.colors.terra} />
                          <Text style={styles.scanStatusPillText}>{scanStatus}</Text>
                        </View>
                      )}
                      <BlurView intensity={40} tint="dark" style={styles.cancelPill}>
                        <Pressable style={({ pressed }) => [styles.clearBtn, pressed && styles.cameraPressed]} onPress={cancelScan} hitSlop={8} accessibilityLabel="Cancel scan" accessibilityRole="button">
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
                                accessibilityLabel="Choose from photo library"
                                accessibilityRole="button"
                              >
                                <AppIcon name="images-outline" size={26} color={theme.colors.white} />
                              </Pressable>
                            </BlurView>
                          )}
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </Pressable>
          )}
          {stagedPhotos.length > 0 && !cameraActive && !scanning && !result && (
            <View style={styles.stagedStripOverlay}>
              {stagedPhotos.map((uri, i) => (
                <View key={`${uri}-${i}`} style={styles.stagedThumb}>
                  <Image source={{ uri }} style={styles.stagedThumbImg} contentFit="cover" cachePolicy="memory-disk" />
                  {!result && (
                    <Pressable
                      style={styles.stagedThumbRemove}
                      onPress={() => handleRemoveStagedPhoto(i)}
                      hitSlop={6}
                      accessibilityLabel={`Remove photo ${i + 1}`}
                      accessibilityRole="button"
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
                    accessibilityLabel="Clear all photos"
                    accessibilityRole="button"
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
                accessibilityLabel="Clear result and scan again"
                accessibilityRole="button"
              >
                <AppIcon name="refresh" size={18} color={theme.colors.white} />
                <Text style={styles.clearBtnText}>Clear</Text>
              </Pressable>
            </BlurView>
          )}
        </View>
        </View>

        {result && (
          <ScanResultCard
            scenario={result}
            onBuyAndTrack={handleBuyAndTrack}
            onAddToCloset={handleAddToCloset}
            onSkip={handleSkip}
            onSaveForLater={handleSaveForLater}
            onNameChange={(name) => setResult((prev) => prev ? { ...prev, name } : null)}
            onConfirmHandmade={() => { Haptics.selectionAsync(); handleConfirmHandmade(); }}
            rescanningHandmade={rescanningHandmade}
            onRescanWrong={() => { Haptics.selectionAsync(); handleRescanWrong(); }}
            rescanningWrong={rescanningWrong}
            onRefreshUpcycle={handleRefreshUpcycle}
            refreshingUpcycle={refreshingUpcycle}
            customDismissed={promptCustomDismissed}
            onDismissCustom={() => { Haptics.selectionAsync(); setPromptCustomDismissed(true); }}
            wrongScanDismissed={promptWrongScanDismissed}
            onDismissWrongScan={() => { Haptics.selectionAsync(); setPromptWrongScanDismissed(true); }}
            redFlagPromptDismissed={promptRedFlagDismissed}
            redFlagDismissed={redFlagDismissed}
            onConfirmRedFlag={() => { Haptics.selectionAsync(); setPromptRedFlagDismissed(true); }}
            onMarkRedFlagFalseAlarm={() => { Haptics.selectionAsync(); setPromptRedFlagDismissed(true); setRedFlagDismissed(true); }}
            historyCount={sessionSnapshots.length}
            onShowHistory={() => { Haptics.selectionAsync(); setScanHistoryVisible(true); }}
            onClearScan={() => { Haptics.selectionAsync(); deleteActiveSessionSnapshot(); }}
            theme={theme}
            styles={scanStyles}
          />
        )}

        {!result && !scanning && scanError && (() => {
          const copy = getScanErrorCopy(scanError);
          return (
            <View
              style={scanStyles.errorCard}
              accessible
              accessibilityLiveRegion="polite"
              accessibilityRole="alert"
              accessibilityLabel={`${copy.title}. ${copy.body}`}
            >
              <View style={scanStyles.errorHeader}>
                <AppIcon name={copy.icon} size={22} color={theme.colors.terra} />
                <Text style={scanStyles.errorTitle}>{copy.title}</Text>
              </View>
              <Text style={scanStyles.errorBody}>{copy.body}</Text>
              <View style={scanStyles.errorActions}>
                <Button
                  label="Clear"
                  variant="secondary"
                  onPress={() => { Haptics.selectionAsync(); clearResultAndPhoto(); }}
                  style={scanStyles.errorActionBtn}
                />
                <Button
                  label="Try again"
                  variant="primary"
                  icon="refresh"
                  onPress={() => { Haptics.selectionAsync(); handleScanStagedRef.current(); }}
                  style={scanStyles.errorActionBtn}
                />
              </View>
            </View>
          );
        })()}

        {!result && !scanError && savedForLater.length === 0 && recents.length === 0 && (
          <EmptyState
            compact
            icon="scan-outline"
            title="Your scan history starts here"
            body="Point the camera at an item and we'll price it on the spot."
          />
        )}

        {savedForLater.length > 0 && (
          <View style={styles.recentsSection}>
            <View style={styles.recentsHeader}>
              <Text style={styles.recentsTitle} accessibilityRole="header">Saved for later</Text>
            </View>
            <FlatList
              data={savedForLater}
              horizontal
              keyExtractor={(item) => String(item.savedAt)}
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => {
                const savedHasRedFlags = (item.redFlags?.length ?? 0) > 0 && !item.redFlagDismissed;
                return (
                  <Pressable
                    style={({ pressed }) => [styles.recentCard, pressed && styles.btnPressed]}
                    onPress={() => openSavedItem(item)}
                  >
                    <View style={styles.savedImgWrap}>
                      {item.photoUri ? (
                        <Image
                          source={{ uri: item.photoUri }}
                          style={styles.recentImg}
                          contentFit="cover"
                          cachePolicy="memory-disk"
                          recyclingKey={String(item.savedAt)}
                        />
                      ) : (
                        <View style={styles.savedPlaceholder} />
                      )}
                      <View style={styles.savedBadge}>
                        <AppIcon name="bookmark" size={12} color={theme.colors.onPrimary} />
                      </View>
                      {savedHasRedFlags && (
                        <View style={styles.recentRedFlag}>
                          <AppIcon name="flag" size={11} color="#FFFFFF" />
                        </View>
                      )}
                    </View>
                    <Text style={styles.recentName} numberOfLines={2}>{item.name}</Text>
                    <Text style={styles.savedProfit}>{item.profit}</Text>
                  </Pressable>
                );
              }}
            />
          </View>
        )}

        {recents.length > 0 && (
          <View style={styles.recentsSection}>
            <View style={styles.recentsHeader}>
              <Text style={styles.recentsTitle} accessibilityRole="header">Recent finds</Text>
            </View>
            <FlatList
              data={recents}
              horizontal
              keyExtractor={(item) => String(item.id)}
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => {
                const activeSnapshot = item.scanSnapshots?.find(s => s.id === item.activeScanSnapshotId) ?? item.scanSnapshots?.[0];
                const hasRedFlags = (activeSnapshot?.redFlags?.length ?? 0) > 0 && !redFlagDismissedIds.has(item.id);
                return (
                  <Pressable
                    style={({ pressed }) => [styles.recentCard, pressed && styles.btnPressed]}
                    onPress={() => router.push({ pathname: '/detail', params: { itemId: String(item.id) } })}
                  >
                    <View style={styles.recentImgWrap}>
                      {item.img ? (
                        <Image
                          source={{ uri: item.img }}
                          style={styles.recentImg}
                          contentFit="cover"
                          cachePolicy="memory-disk"
                          recyclingKey={String(item.id)}
                        />
                      ) : (
                        <View style={styles.recentImgPlaceholder}>
                          <AppIcon name="camera-outline" size={22} color={theme.colors.mauve} />
                        </View>
                      )}
                      {hasRedFlags && (
                        <View style={styles.recentRedFlag}>
                          <AppIcon name="flag" size={11} color="#FFFFFF" />
                        </View>
                      )}
                    </View>
                    <View style={styles.recentFooter}>
                      <Text style={styles.recentName} numberOfLines={2}>{item.name}</Text>
                      {item.resale > 0 && (
                        <Text style={styles.recentPrice} numberOfLines={1}>{formatMoney(item.resale)}</Text>
                      )}
                    </View>
                  </Pressable>
                );
              }}
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
                    <Image source={{ uri: candidate.img }} style={styles.duplicateThumb} contentFit="cover" cachePolicy="memory-disk" />
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
      <Modal
        visible={photoViewerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPhotoViewerVisible(false)}
      >
        <Pressable style={styles.photoViewerOverlay} onPress={() => setPhotoViewerVisible(false)}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={{ width: screenWidth }}
            contentContainerStyle={{ alignItems: 'center' }}
          >
            {(stagedPhotos.length > 0 ? stagedPhotos : placeholderImageUri ? [placeholderImageUri] : []).map((uri, i) => (
              <Pressable key={`${uri}-${i}`} style={[styles.photoViewerPage, { width: screenWidth }]} onPress={() => setPhotoViewerVisible(false)}>
                <Image source={{ uri }} style={styles.photoViewerImg} contentFit="contain" cachePolicy="memory-disk" />
              </Pressable>
            ))}
          </ScrollView>
          <Pressable
            style={[styles.photoViewerClose, { paddingTop: insets.top + 8 }]}
            onPress={() => setPhotoViewerVisible(false)}
            accessibilityLabel="Close"
            accessibilityRole="button"
          >
            <AppIcon name="close" size={28} color={theme.colors.overlayWhiteStrong} />
          </Pressable>
        </Pressable>
      </Modal>
      <Modal
        visible={scanHistoryVisible}
        transparent
        animationType="none"
        onRequestClose={dismissHistorySheet}
      >
        <Pressable style={styles.historyOverlay} onPress={dismissHistorySheet}>
          <Animated.View
            style={[styles.historyCard, { transform: [{ translateY: historySheetTranslateY }] }]}
          >
            <Pressable onPress={(e) => e.stopPropagation()} style={styles.historySheetInner}>
              <View style={styles.historyDragArea} {...historySheetPanResponder.panHandlers}>
                <View style={styles.historyHandle} />
              </View>
              <View style={styles.historyHeaderRow}>
                <Text style={styles.historyTitle} accessibilityRole="header">Scan history</Text>
                <View style={styles.historyHeaderBadge}>
                  <Text style={styles.historyHeaderBadgeText}>
                    {sessionSnapshots.length} scan{sessionSnapshots.length === 1 ? '' : 's'}
                  </Text>
                </View>
              </View>
              <ScrollView style={styles.historyList} showsVerticalScrollIndicator={false}>
                {sessionSnapshots.map((snapshot) => {
                  const isActive = snapshot.id === activeSessionSnapshotId;
                  const confColor = snapshot.confidence
                    ? getConfidenceColor(theme, snapshot.confidence)
                    : theme.colors.mauve;
                  return (
                    <Pressable
                      key={snapshot.id}
                      style={[styles.historyRow, isActive && styles.historyRowActive]}
                      onPress={() => switchActiveSessionSnapshot(snapshot.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Switch to scan from ${formatSnapshotTime(snapshot.createdAt)}`}
                    >
                      <View style={styles.historyRowThumb}>
                        {snapshot.sourceImageUri ? (
                          <Image source={{ uri: snapshot.sourceImageUri }} style={styles.historyRowThumbImg} contentFit="cover" cachePolicy="memory-disk" />
                        ) : (
                          <AppIcon name="camera-outline" size={20} color={theme.colors.mauve} />
                        )}
                      </View>
                      <View style={styles.historyRowMain}>
                        <View style={styles.historyRowTopLine}>
                          <Text style={styles.historyRowName} numberOfLines={1}>
                            {snapshot.scenario.name}
                          </Text>
                          {isActive && (
                            <View style={styles.historyActivePill}>
                              <Text style={styles.historyActivePillText}>Active</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.historyRowTime}>{formatSnapshotTime(snapshot.createdAt)}</Text>
                        <View style={styles.historyRowMetaRow}>
                          <Text style={styles.historyRowProfit}>{snapshot.profit || ','}</Text>
                          {snapshot.confidence ? (
                            <>
                              <Text style={styles.historyRowDot}> · </Text>
                              <View style={[styles.historyConfDot, { backgroundColor: confColor }]} />
                              <Text style={[styles.historyRowMeta, { color: confColor }]}>
                                {snapshot.confidence.charAt(0).toUpperCase() + snapshot.confidence.slice(1)} confidence
                              </Text>
                            </>
                          ) : null}
                          {snapshot.isCustom ? (
                            <View style={styles.historyIsCustomPill}>
                              <Text style={styles.historyIsCustomPillText}>Handmade</Text>
                            </View>
                          ) : null}
                        </View>
                      </View>
                      <AppIcon name="chevron-forward" size={16} color={theme.colors.mauve} />
                    </Pressable>
                  );
                })}
              </ScrollView>
              <Pressable style={styles.historyCloseBtn} onPress={dismissHistorySheet} accessibilityRole="button" accessibilityLabel="Close scan history">
                <Text style={styles.historyCloseBtnText}>Close</Text>
              </Pressable>
            </Pressable>
          </Animated.View>
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
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    ...(formMaxWidth ? { maxWidth: formMaxWidth, alignSelf: 'center' as const, width: '100%' as const } : {}),
  },
  headerTitleBlock: {
    flex: 1,
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
  versionTag: {
    ...theme.typography.caption,
    color: theme.colors.mauve,
    marginTop: 10,
    marginLeft: 12,
  },
  cameraBoxWrap: {
    marginHorizontal: hPad,
    borderRadius: 24,
    borderWidth: 2.5,
    borderColor: 'transparent',
    ...(isTablet ? { maxWidth: 600, alignSelf: 'center' as const, width: '100%' as const } : {}),
  },
  cameraBox: {
    aspectRatio: 1 / 1,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: theme.colors.cream,
  },
  cameraBoxRedFlag: {
    borderColor: theme.colors.loss,
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
    left: 20,
  },
  cameraOverlayScan: {
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
  searchingTextRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  searchingText: {
    ...theme.typography.body,
    fontWeight: '600',
    color: theme.colors.overlayWhiteStrong,
    fontVariant: ['tabular-nums'],
  },
  searchingTimer: {
    width: 40,
    textAlign: 'left',
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
  recentImgWrap: {
    width: 100,
    height: 100,
    position: 'relative' as const,
  },
  recentImg: {
    width: 100,
    height: 100,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceVariant,
  },
  recentRedFlag: {
    position: 'absolute' as const,
    top: 6,
    right: 6,
    backgroundColor: theme.colors.loss,
    padding: 4,
    borderRadius: theme.radius.full,
  },
  recentImgPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceVariant,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  recentFooter: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: theme.spacing.xs,
    gap: theme.spacing.xs,
  },
  recentName: {
    ...theme.typography.caption,
    color: theme.colors.charcoal,
    flex: 1,
  },
  recentPrice: {
    ...theme.typography.caption,
    color: theme.colors.profit,
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
  photoViewerOverlay: {
    flex: 1,
    backgroundColor: theme.colors.photoBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoViewerPage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoViewerImg: {
    width: '100%',
    height: '100%',
  },
  photoViewerClose: {
    position: 'absolute',
    top: 0,
    right: 16,
    padding: 8,
  },
  historyOverlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
  },
  historyCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    paddingTop: 12,
    maxHeight: '72%',
    ...(theme.shadows.md ?? {}),
  },
  historySheetInner: {
    flex: 1,
  },
  historyDragArea: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  historyHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.surfaceVariant,
  },
  historyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.surfaceVariant,
  },
  historyTitle: {
    ...theme.typography.bodySmall,
    color: theme.colors.charcoal,
    fontWeight: '600',
    flex: 1,
  },
  historyHeaderBadge: {
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.surfaceVariant,
    backgroundColor: theme.colors.surfaceVariant,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 3,
  },
  historyHeaderBadgeText: {
    ...theme.typography.caption,
    color: theme.colors.charcoal,
  },
  historyList: {
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: theme.radius.sm,
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginBottom: 4,
    gap: 10,
  },
  historyRowActive: {
    backgroundColor: theme.colors.surfaceVariant,
  },
  historyRowThumb: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.blush,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  historyRowThumbImg: {
    width: 44,
    height: 44,
  },
  historyRowMain: {
    flex: 1,
    minWidth: 0,
  },
  historyRowTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  historyRowName: {
    ...theme.typography.caption,
    color: theme.colors.charcoal,
    fontWeight: '600',
    flex: 1,
  },
  historyRowTime: {
    ...theme.typography.caption,
    color: theme.colors.mauve,
    marginTop: 2,
  },
  historyRowMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    flexWrap: 'wrap',
    gap: 4,
  },
  historyRowProfit: {
    ...theme.typography.caption,
    color: theme.colors.profit,
    fontWeight: '600',
  },
  historyRowDot: {
    ...theme.typography.caption,
    color: theme.colors.mauve,
  },
  historyConfDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    flexShrink: 0,
  },
  historyRowMeta: {
    ...theme.typography.caption,
    color: theme.colors.mauve,
  },
  historyActivePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.vintageBlueLight,
  },
  historyActivePillText: {
    ...theme.typography.label,
    color: theme.colors.vintageBlueDark,
    fontWeight: '600',
  },
  historyIsCustomPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.terraLight,
  },
  historyIsCustomPillText: {
    ...theme.typography.label,
    color: theme.colors.terra,
    fontWeight: '600',
  },
  historyCloseBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.lg,
    marginTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.surfaceVariant,
    minHeight: theme.minTouchTargetSize,
  },
  historyCloseBtnText: {
    ...theme.typography.body,
    color: theme.colors.mauve,
  },
  });
}
