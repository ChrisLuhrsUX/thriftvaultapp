import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Image,
  InputAccessoryView,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from '@/components/AppIcon';
import { useInventory } from '@/context/InventoryContext';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { useResponsive } from '@/hooks/useResponsive';
import { getConfidenceColor } from '@/utils/confidencePresentation';
import { ITEM_CATEGORIES, type Item, type ItemScanSnapshot, type ItemStatus, type Platform as PlatformType } from '@/types/inventory';
import type { Theme } from '@/theme';

const STATUS_OPTIONS: ItemStatus[] = ['unlisted', 'listed', 'sold'];
const KNOWN_PLATFORMS: PlatformType[] = ['Poshmark', 'Depop', 'eBay', 'Mercari', 'Facebook Marketplace', 'Vinted', 'Shopify'];
/** iOS: decimal-pad has no Done key; pairs with InputAccessoryView on profit fields */
const PRICE_INPUT_ACCESSORY_ID = 'tvPriceInputAccessory';

function buildShareMessage(item: Item): string {
  const name = item.name;
  if (item.intent === 'closet') {
    const paid = Number(item.paid) || 0;
    return `From my closet: ${name} (paid $${paid}). I track pieces with ThriftVault.`;
  }
  if (item.status === 'sold' && item.soldPrice != null) {
    return `Sold this flip: ${name} for $${Number(item.soldPrice)}. Tracked with ThriftVault.`;
  }
  const resale = Number(item.resale) || 0;
  return `Thrift find: ${name} — targeting $${resale} resale. Track your flips with ThriftVault.`;
}

function isUserCanceledShareError(e: unknown): boolean {
  if (e == null) return false;
  if (typeof e === 'object' && e !== null) {
    if ('name' in e && (e as { name: string }).name === 'AbortError') return true;
    if ('message' in e) {
      const msg = String((e as { message: unknown }).message).toLowerCase();
      if (
        msg.includes('cancel') ||
        msg.includes('abort') ||
        msg.includes('dismiss') ||
        msg.includes('user did not share')
      ) {
        return true;
      }
    }
  }
  return false;
}

/** Strip everything except digits and a single decimal point. */
function sanitizePrice(raw: string): string {
  let result = '';
  let hasDot = false;
  for (const ch of raw) {
    if (ch >= '0' && ch <= '9') {
      result += ch;
    } else if (ch === '.' && !hasDot) {
      hasDot = true;
      result += ch;
    }
  }
  return result;
}

export default function DetailScreen() {
  const { itemId, fromScan, manual } = useLocalSearchParams<{ itemId: string; fromScan?: string; manual?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { getItemById, updateItem, removeItem } = useInventory();
  const { showToast } = useToast();
  const [imageFullScreenVisible, setImageFullScreenVisible] = useState(false);
  const [itemMenuVisible, setItemMenuVisible] = useState(false);
  const [item, setItem] = useState<Item | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [galleryWidth, setGalleryWidth] = useState(0);
  const [paidStr, setPaidStr] = useState('');
  const [resaleStr, setResaleStr] = useState('');
  const [soldStr, setSoldStr] = useState('');
  const [scanInsightsExpanded, setScanInsightsExpanded] = useState(false);
  const [scanHistoryVisible, setScanHistoryVisible] = useState(false);
  const [addPhotoModalVisible, setAddPhotoModalVisible] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const hasEdited = useRef(false);
  const priceInitialized = useRef(false);
  const paidInputRef = useRef<TextInput>(null);
  const resaleInputRef = useRef<TextInput>(null);
  const soldInputRef = useRef<TextInput>(null);
  const { width: screenWidth } = useWindowDimensions();
  const fullScreenScrollRef = useRef<ScrollView>(null);
  const { formMaxWidth } = useResponsive();
  const styles = React.useMemo(() => createStyles(theme, formMaxWidth), [theme, formMaxWidth]);

  const lastScrollYRef = useRef(0);
  const keyboardShowTsRef = useRef(0);

  useEffect(() => {
    if (Platform.OS === 'web') return undefined;
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const subShow = Keyboard.addListener(showEvent, () => {
      keyboardShowTsRef.current = Date.now();
    });
    const subHide = Keyboard.addListener(hideEvent, () => {
      keyboardShowTsRef.current = 0;
    });
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, []);

  const handleScrollDismissKeyboard = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const t = keyboardShowTsRef.current;
    if (t > 0 && Date.now() - t < 450) {
      lastScrollYRef.current = y;
      return;
    }
    if (y > lastScrollYRef.current + 8) {
      Keyboard.dismiss();
    }
    lastScrollYRef.current = y;
  }, []);

  const imageFullScreenTranslateY = useRef(new Animated.Value(0)).current;

  const handleSaveImageToCameraRoll = useCallback(async () => {
    const currentPhotos = item?.photos && item.photos.length > 0 ? item.photos : (item?.img ? [item.img] : []);
    const activePhoto = currentPhotos[photoIndex] ?? currentPhotos[0];
    if (!activePhoto) return;
    if (Platform.OS === 'web') {
      showToast('Save to camera roll is not available on web');
      return;
    }
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        showToast('Permission needed to save to camera roll');
        return;
      }
      const cacheDir = FileSystem.cacheDirectory;
      if (!cacheDir) throw new Error('No cache directory');
      const ext = activePhoto.split('?')[0].endsWith('.png') ? '.png' : '.jpg';
      const localUri = cacheDir + `thriftvault_${item?.id}_${Date.now()}${ext}`;
      await FileSystem.downloadAsync(activePhoto, localUri);
      await MediaLibrary.saveToLibraryAsync(localUri);
      showToast('Saved to camera roll');
    } catch {
      showToast('Could not save image');
    }
  }, [item?.id, item?.img, item?.photos, photoIndex, showToast]);

  const imageFullScreenPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > Math.abs(g.dx) && g.dy > 2,
        onPanResponderMove: (_, g) => {
          if (g.dy > 0) imageFullScreenTranslateY.setValue(g.dy);
        },
        onPanResponderRelease: (_, g) => {
          if (g.dy > 80 || g.vy > 0.5) {
            Animated.timing(imageFullScreenTranslateY, {
              toValue: 400,
              duration: 280,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }).start(() => {
              imageFullScreenTranslateY.setValue(0);
              setImageFullScreenVisible(false);
            });
          } else {
            Animated.spring(imageFullScreenTranslateY, {
              toValue: 0,
              useNativeDriver: true,
              tension: 80,
              friction: 12,
            }).start();
          }
        },
      }),
    [imageFullScreenTranslateY]
  );

  const id = itemId != null ? Number(itemId) : NaN;

  useEffect(() => {
    lastScrollYRef.current = 0;
  }, [id]);

  useEffect(() => {
    if (Number.isNaN(id)) {
      setNotFound(true);
      return;
    }
    const found = getItemById(id);
    if (found) {
      setItem({ ...found });
      if (manual === '1') {
        setEditedName(found.name);
        setEditingName(true);
      }
    } else {
      setNotFound(true);
    }
  }, [id, getItemById, manual]);

  useEffect(() => {
    if (item && !priceInitialized.current) {
      setPaidStr(String(item.paid));
      setResaleStr(String(item.resale));
      setSoldStr(item.soldPrice != null ? String(item.soldPrice) : '');
      priceInitialized.current = true;
    }
  }, [item]);

  useEffect(() => {
    if (!item?.scanSnapshots || item.scanSnapshots.length === 0) return;
    setScanInsightsExpanded(fromScan === '1');
  }, [fromScan, item?.id, item?.scanSnapshots]);

  const update = useCallback((updates: Partial<Item>) => {
    hasEdited.current = true;
    setItem((prev) => (prev ? { ...prev, ...updates } : null));
  }, []);

  const flushPrices = useCallback((updates: Partial<Item>) => {
    setItem((prev) => {
      if (!prev) return null;
      const next = { ...prev, ...updates };
      updateItem(next.id, next);
      return next;
    });
  }, [updateItem]);

  React.useEffect(() => {
    if (imageFullScreenVisible && screenWidth > 0) {
      setTimeout(() => {
        fullScreenScrollRef.current?.scrollTo({ x: photoIndex * screenWidth, animated: false });
      }, 30);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageFullScreenVisible]);

  const saveAndBack = useCallback(() => {
    if (item) {
      if (manual === '1' && !hasEdited.current) {
        removeItem(item.id);
      } else {
        updateItem(item.id, item);
      }
    }
    router.back();
  }, [item, manual, updateItem, removeItem, router]);

  const getActiveSnapshot = useCallback((targetItem: Item): ItemScanSnapshot | null => {
    const snapshots = targetItem.scanSnapshots;
    if (!snapshots || snapshots.length === 0) return null;
    if (targetItem.activeScanSnapshotId) {
      const active = snapshots.find((snapshot) => snapshot.id === targetItem.activeScanSnapshotId);
      if (active) return active;
    }
    return snapshots[0] ?? null;
  }, []);

  const formatSnapshotTime = useCallback((createdAt: number) => {
    const date = new Date(createdAt);
    if (Number.isNaN(date.getTime())) return 'Unknown time';
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }, []);

  const switchActiveSnapshot = useCallback((snapshotId: string) => {
    if (!item) return;
    updateItem(item.id, { activeScanSnapshotId: snapshotId });
    update({ activeScanSnapshotId: snapshotId });
    setScanHistoryVisible(false);
  }, [item, update, updateItem]);

  const handleMarkSold = useCallback(() => {
    if (!item) return;
    const soldPrice = item.resale;
    updateItem(item.id, { status: 'sold', soldPrice });
    setItem((prev) => prev ? { ...prev, status: 'sold', soldPrice } : null);
    showToast(`Sold for $${soldPrice}`);
  }, [item, updateItem, showToast]);

  const executeAddPhoto = useCallback(
    async (useCamera: boolean) => {
      if (!item) return;
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          showToast('Camera permission is required to take photos');
          return;
        }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          showToast('Photo library permission is required');
          return;
        }
      }
      const currentPhotos =
        item.photos && item.photos.length > 0 ? item.photos : (item.img ? [item.img] : []);
      const opts: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      };
      try {
        const result = useCamera
          ? await ImagePicker.launchCameraAsync(opts)
          : await ImagePicker.launchImageLibraryAsync(opts);
        if (result.canceled || !result.assets?.[0]?.uri) return;
        const src = result.assets[0].uri;
        const dest = (FileSystem.documentDirectory ?? '') + `item_${item.id}_${Date.now()}.jpg`;
        await FileSystem.copyAsync({ from: src, to: dest });
        const newPhotos = [...currentPhotos, dest];
        updateItem(item.id, { photos: newPhotos, img: newPhotos[0] });
        update({ photos: newPhotos, img: newPhotos[0] });
        setPhotoIndex(newPhotos.length - 1);
        showToast('Photo added');
      } catch {
        showToast('Could not add photo');
      }
    },
    [item, update, updateItem, showToast]
  );

  const pendingPhotoAction = useRef<boolean | null>(null);

  const closeAddPhotoModal = useCallback(() => {
    setAddPhotoModalVisible(false);
  }, []);

  // Android fallback: onDismiss doesn't fire on Android
  useEffect(() => {
    if (!addPhotoModalVisible && pendingPhotoAction.current !== null && Platform.OS === 'android') {
      const useCamera = pendingPhotoAction.current;
      pendingPhotoAction.current = null;
      const timer = setTimeout(() => void executeAddPhoto(useCamera), 300);
      return () => clearTimeout(timer);
    }
  }, [addPhotoModalVisible, executeAddPhoto]);

  const handleAddPhoto = useCallback(async () => {
    if (!item) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (Platform.OS === 'web') {
      await executeAddPhoto(false);
      return;
    }
    Keyboard.dismiss();
    setAddPhotoModalVisible(true);
  }, [item, executeAddPhoto]);

  const handleRemovePhoto = useCallback((index: number) => {
    if (!item) return;
    const currentPhotos = item.photos && item.photos.length > 0 ? item.photos : (item.img ? [item.img] : []);
    const doRemove = () => {
      const newPhotos = currentPhotos.filter((_, i) => i !== index);
      const newImg = newPhotos[0] ?? '';
      updateItem(item.id, { photos: newPhotos, img: newImg });
      update({ photos: newPhotos, img: newImg });
      setPhotoIndex((prev) => Math.min(prev, Math.max(0, newPhotos.length - 1)));
    };
    Alert.alert('Delete Photo', 'Delete this photo?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: doRemove },
    ]);
  }, [item, update, updateItem]);

  const showItemMenu = useCallback(() => {
    Keyboard.dismiss();
    setItemMenuVisible(true);
  }, []);

  const closeItemMenu = useCallback(() => {
    setItemMenuVisible(false);
  }, []);

  const handleShare = useCallback(async () => {
    if (!item) return;
    const message = buildShareMessage(item);
    try {
      if (Platform.OS === 'web') {
        if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
          try {
            await navigator.share({ title: item.name, text: message });
          } catch (e) {
            if (isUserCanceledShareError(e)) return;
            if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
              await navigator.clipboard.writeText(message);
              showToast('Copied to clipboard');
            } else {
              showToast('Copy not available in this browser');
            }
          }
        } else if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(message);
          showToast('Copied to clipboard');
        } else {
          showToast('Sharing needs a secure browser (HTTPS) or clipboard access');
        }
        return;
      }
      const result = await Share.share(
        Platform.OS === 'ios'
          ? { message: `${item.name}\n\n${message}` }
          : { message, title: item.name },
      );
      if (result?.action === Share.dismissedAction) {
        return;
      }
    } catch (e: unknown) {
      if (isUserCanceledShareError(e)) return;
      console.warn('[ThriftVault] Share failed:', e);
      showToast('Unable to open share sheet');
    }
  }, [item, showToast]);

  const handleDeleteConfirm = useCallback(() => {
    if (!item) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert('Delete item', `Remove "${item.name}" from your vault?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => {
        removeItem(item.id);
        router.back();
        showToast('Item removed');
      } },
    ]);
  }, [item, removeItem, router, showToast]);

  if (notFound) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <Pressable onPress={() => router.back()} style={styles.headerBtn}>
            <AppIcon name="arrow-back" size={24} color={theme.colors.charcoal} />
          </Pressable>
        </View>
        <View style={styles.errorWrap}>
          <Text style={styles.errorText}>Item not found</Text>
          <Pressable onPress={() => router.back()} style={styles.errorBtn}>
            <Text style={styles.errorBtnText}>Go back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (!item) return null;

  const photos = item.photos && item.photos.length > 0 ? item.photos : (item.img ? [item.img] : []);
  const snapshots = item.scanSnapshots ?? [];
  const activeSnapshot = getActiveSnapshot(item);

  const isCloset = item.intent === 'closet';
  const paidNum = Number(item.paid) || 0;
  const resaleNum = Number(item.resale) || 0;
  const soldNum =
    item.status === 'sold' && item.soldPrice != null
      ? Number(item.soldPrice)
      : null;
  const revenue = soldNum ?? resaleNum;
  const paidEntered = paidStr.trim() !== '';
  const profit = paidEntered ? revenue - paidNum : 0;
  const roiPct = paidEntered && paidNum > 0 ? Math.round((profit / paidNum) * 100) : 0;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Pressable onPress={saveAndBack} style={styles.headerBtn}>
          <AppIcon name="arrow-back" size={24} color={theme.colors.charcoal} />
        </Pressable>
        <View style={styles.headerTitleWrap}>
          {editingName ? (
            <TextInput
              style={[styles.headerTitle, styles.headerTitleInput]}
              value={editedName}
              onChangeText={setEditedName}
              onBlur={() => {
                const trimmed = editedName.trim();
                if (trimmed && trimmed !== item.name) update({ name: trimmed });
                else setEditedName(item.name);
                setEditingName(false);
              }}
              onSubmitEditing={() => {
                const trimmed = editedName.trim();
                if (trimmed && trimmed !== item.name) update({ name: trimmed });
                else setEditedName(item.name);
                setEditingName(false);
              }}
              autoFocus
              selectTextOnFocus
              returnKeyType="done"
            />
          ) : (
            <Pressable
              onPress={() => { setEditedName(item.name); setEditingName(true); }}
              style={styles.headerTitleRow}
            >
              <Text style={styles.headerTitle} numberOfLines={1}>{item.name}</Text>
              <AppIcon name="pencil" size={14} color={theme.colors.mauve} />
            </Pressable>
          )}
          {activeSnapshot?.sub ? (
            <Text style={styles.headerSub} numberOfLines={1}>{activeSnapshot.sub}</Text>
          ) : null}
        </View>
        <Pressable
          onPress={showItemMenu}
          style={styles.headerBtn}
        >
          <AppIcon name="ellipsis-horizontal" size={24} color={theme.colors.charcoal} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        onScrollBeginDrag={() => Keyboard.dismiss()}
        onScroll={handleScrollDismissKeyboard}
        scrollEventThrottle={16}
        nestedScrollEnabled
      >
        <View
          style={styles.galleryWrap}
          onLayout={(e) => setGalleryWidth(e.nativeEvent.layout.width)}
        >
          {galleryWidth > 0 && (() => {
            return (
              <>
                <ScrollView
                  horizontal
                  pagingEnabled
                  scrollEnabled={photos.length > 1}
                  showsHorizontalScrollIndicator={false}
                  onMomentumScrollEnd={(e) => {
                    setPhotoIndex(Math.round(e.nativeEvent.contentOffset.x / galleryWidth));
                  }}
                >
                  {photos.length > 0 ? photos.map((uri, i) => (
                    <View key={`${uri}-${i}`} style={[styles.galleryPage, { width: galleryWidth, height: galleryWidth }]}>
                      <Pressable
                        style={styles.imgPressable}
                        onPress={() => { setPhotoIndex(i); setImageFullScreenVisible(true); }}
                        accessibilityLabel="View image full screen"
                      >
                        <Image source={{ uri }} style={styles.img} />
                      </Pressable>
                    </View>
                  )) : (
                    <Pressable
                      style={[styles.galleryEmpty, { width: galleryWidth, height: galleryWidth }]}
                      onPress={handleAddPhoto}
                    >
                      <AppIcon name="camera-outline" size={48} color={theme.colors.mauve} />
                      <Text style={styles.galleryEmptyTitle}>No photos yet</Text>
                      <Text style={styles.galleryEmptySub}>Tap to add photos</Text>
                    </Pressable>
                  )}
                </ScrollView>

                <Pressable
                  style={({ pressed }) => [styles.galleryAddBtn, pressed && { opacity: 0.7 }]}
                  onPress={handleAddPhoto}
                  accessibilityLabel="Add photo"
                >
                  <AppIcon name="camera" size={18} color="rgba(255,255,255,0.85)" />
                </Pressable>
                {photos.length > 1 && (
                  <View style={styles.galleryDots}>
                    {photos.map((_, i) => (
                      <View key={i} style={[styles.photoDot, i === photoIndex && styles.photoDotActive]} />
                    ))}
                  </View>
                )}
              </>
            );
          })()}

          {!isCloset && (
            <View style={[
              styles.badge,
              item.status === 'sold' && styles.badgeSold,
              item.status === 'unlisted' && styles.badgeUnlisted,
              item.status === 'listed' && styles.badgeListed,
            ]}>
              <Text style={[
                styles.badgeText,
                item.status === 'sold' && styles.badgeTextSold,
                item.status === 'unlisted' && styles.badgeTextUnlisted,
                item.status === 'listed' && styles.badgeTextListed,
              ]}>
                {item.status === 'sold' ? 'Sold' : item.status === 'unlisted' ? 'Unlisted' : 'Listed'}
              </Text>
            </View>
          )}
        </View>

        {isCloset ? (
          <View style={styles.profitStrip}>
            <View style={styles.profitStripBlock}>
              <Text style={styles.profitStripVal}>${paidNum}</Text>
              <Text style={styles.profitStripLabel}>Paid</Text>
            </View>
          </View>
        ) : (
          <View style={styles.profitStrip}>
            <View style={styles.profitStripBlock}>
              <View style={styles.profitStripInputRow}>
                <Text style={styles.profitStripVal}>$</Text>
                <TextInput
                  ref={paidInputRef}
                  style={styles.profitStripInput}
                  value={paidStr}
                  onChangeText={(t) => {
                    const s = sanitizePrice(t);
                    setPaidStr(s);
                    const val = parseFloat(s);
                    if (!isNaN(val)) update({ paid: val });
                  }}
                  onBlur={() => {
                    const val = parseFloat(paidStr);
                    flushPrices({ paid: isNaN(val) ? 0 : val });
                  }}
                  keyboardType="decimal-pad"
                  inputAccessoryViewID={Platform.OS === 'ios' ? PRICE_INPUT_ACCESSORY_ID : undefined}
                  placeholder="0"
                  placeholderTextColor={theme.colors.mauve}
                />
              </View>
              <Text style={styles.profitStripLabel}>Paid</Text>
            </View>
            <View style={styles.profitStripDivider} />
            <View style={styles.profitStripBlock}>
              <View style={styles.profitStripInputRow}>
                <Text style={styles.profitStripVal}>$</Text>
                <TextInput
                  ref={soldNum != null ? soldInputRef : resaleInputRef}
                  style={styles.profitStripInput}
                  value={soldNum != null ? soldStr : resaleStr}
                  onChangeText={(t) => {
                    const s = sanitizePrice(t);
                    if (soldNum != null) {
                      setSoldStr(s);
                      const val = parseFloat(s);
                      if (!isNaN(val)) update({ soldPrice: val });
                    } else {
                      setResaleStr(s);
                      const val = parseFloat(s);
                      if (!isNaN(val)) update({ resale: val });
                    }
                  }}
                  onBlur={() => {
                    if (soldNum != null) {
                      const val = parseFloat(soldStr);
                      flushPrices({ soldPrice: isNaN(val) ? null : val });
                    } else {
                      const val = parseFloat(resaleStr);
                      flushPrices({ resale: isNaN(val) ? 0 : val });
                    }
                  }}
                  keyboardType="decimal-pad"
                  inputAccessoryViewID={Platform.OS === 'ios' ? PRICE_INPUT_ACCESSORY_ID : undefined}
                  placeholder="0.00"
                  placeholderTextColor={theme.colors.mauve}
                />
              </View>
              <Text style={styles.profitStripLabel}>{soldNum != null ? 'Sold' : 'Resale'}</Text>
            </View>
            <View style={styles.profitStripDivider} />
            <View style={styles.profitStripBlock}>
              <Text style={[styles.profitStripVal, profit >= 0 ? styles.profitPos : styles.profitNeg]}>
                {profit >= 0 ? '+' : ''}${profit.toFixed(0)}
              </Text>
              <Text style={styles.profitStripLabel}>{soldNum != null ? 'Profit' : 'Est. Profit'}</Text>
            </View>
            <View style={styles.profitStripDivider} />
            <View style={styles.profitStripBlock}>
              <Text
                style={[
                  styles.profitStripVal,
                  profit >= 0 ? styles.profitPos : styles.profitNeg,
                  paidEntered && paidNum === 0 && revenue > 0 && styles.profitStripRoiInfinity,
                ]}
              >
                {paidEntered && paidNum === 0 && revenue > 0 ? '∞' : `${roiPct}%`}
              </Text>
              <Text style={styles.profitStripLabel}>ROI</Text>
            </View>
          </View>
        )}

        {snapshots.length > 0 && activeSnapshot && (
          <View style={styles.insightsWrap}>
            <Pressable
              style={({ pressed }) => [styles.insightsHeader, pressed && styles.btnPressed]}
              onPress={() => setScanInsightsExpanded((prev) => !prev)}
              accessibilityRole="button"
              accessibilityState={{ expanded: scanInsightsExpanded }}
            >
              <View style={styles.insightsHeaderLeft}>
                <View style={{ flexDirection: 'row' }}>
                  <View style={{ alignItems: 'flex-start' }}>
                    <Text style={styles.insightsTitle}>AI insights</Text>
                    <Text style={styles.insightsProfit}>{activeSnapshot.profit || ''}</Text>
                  </View>
                  <View style={{ alignItems: 'center', paddingHorizontal: theme.spacing.xs }}>
                    <Text style={styles.insightsMeta}> · </Text>
                    <Text style={styles.insightsMeta}> · </Text>
                  </View>
                  <View style={{ alignItems: 'flex-start' }}>
                    {activeSnapshot.confidence ? (
                      <Text
                        style={[
                          styles.insightsConfidence,
                          { color: getConfidenceColor(theme, activeSnapshot.confidence) },
                        ]}
                      >
                        {activeSnapshot.confidence[0].toUpperCase() + activeSnapshot.confidence.slice(1)} confidence
                      </Text>
                    ) : null}
                    <Text style={styles.insightsMeta}>{formatSnapshotTime(activeSnapshot.createdAt)}</Text>
                  </View>
                </View>
              </View>
              <View style={styles.insightsHeaderRight}>
                <View style={styles.insightsCountBadge}>
                  <Text style={styles.insightsCountText}>
                    {snapshots.length} scan{snapshots.length === 1 ? '' : 's'}
                  </Text>
                </View>
                <AppIcon
                  name={scanInsightsExpanded ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={theme.colors.mauve}
                />
              </View>
            </Pressable>

            {scanInsightsExpanded && (
              <View style={styles.insightsContent}>
                {activeSnapshot.sub ? (
                  <Text style={styles.insightsSub}>{activeSnapshot.sub}</Text>
                ) : (
                  <Text style={styles.insightsSub}>No additional summary for this scan.</Text>
                )}
                <View style={styles.insightsIdeas}>
                  {activeSnapshot.ideas.length > 0 ? (
                    activeSnapshot.ideas.map((idea, index) => (
                      <View key={`${activeSnapshot.id}-${index}`} style={styles.insightIdeaRow}>
                        <AppIcon name={idea.ideaIcon as any} size={16} color={theme.colors.vintageBlueDark} />
                        <View style={styles.insightIdeaBody}>
                          <Text style={styles.insightIdeaText}>{idea.t}</Text>
                        </View>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.insightsEmptyIdeas}>No flip suggestions for this scan.</Text>
                  )}
                </View>
                {snapshots.length > 1 && (
                  <Pressable
                    style={({ pressed }) => [styles.historyBtn, pressed && styles.btnPressed]}
                    onPress={() => setScanHistoryVisible(true)}
                  >
                    <Text style={styles.historyBtnText}>Previous scans</Text>
                  </Pressable>
                )}
              </View>
            )}
          </View>
        )}

        <View style={styles.fields}>
          <FieldRow label="Date" value={item.date} editable={false} styles={styles} theme={theme} />
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Category</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.platformRowScroll}
              style={styles.platformRowScrollView}
            >
              {ITEM_CATEGORIES.map((c) => (
                <Pressable
                  key={c}
                  style={[styles.platformChip, item.cat === c && styles.platformChipActive]}
                  onPress={() => update({ cat: item.cat === c ? '' as any : c })}
                >
                  <Text style={[styles.platformChipText, item.cat === c && styles.platformChipTextActive]}>
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
          <FieldRow
            label="Store"
            value={item.store}
            onChangeText={(t) => update({ store: t })}
            placeholder="Store (optional)"
            styles={styles}
            theme={theme}
          />
          {!isCloset && (
            <>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Platform</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.platformRowScroll}
                  style={styles.platformRowScrollView}
                >
                  {KNOWN_PLATFORMS.map((p) => (
                    <Pressable
                      key={p}
                      style={[styles.platformChip, item.platform === p && styles.platformChipActive]}
                      onPress={() => update({ platform: item.platform === p ? '' : p })}
                    >
                      <Text style={[styles.platformChipText, item.platform === p && styles.platformChipTextActive]}>{p}</Text>
                    </Pressable>
                  ))}
                  <Pressable
                    style={[styles.platformChip, !KNOWN_PLATFORMS.includes(item.platform) && styles.platformChipActive]}
                    onPress={() => update({ platform: '' })}
                  >
                    <Text style={[styles.platformChipText, !KNOWN_PLATFORMS.includes(item.platform) && styles.platformChipTextActive]}>Other</Text>
                  </Pressable>
                </ScrollView>
                {!KNOWN_PLATFORMS.includes(item.platform) && (
                  <TextInput
                    style={[styles.fieldInput, { marginTop: 8 }]}
                    value={item.platform}
                    onChangeText={(t) => update({ platform: t })}
                    placeholder="Type platform name..."
                    placeholderTextColor={theme.colors.mauve}
                  />
                )}
              </View>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Status</Text>
                <View style={styles.statusRow}>
                  {STATUS_OPTIONS.map((s) => (
                    <Pressable
                      key={s}
                      style={[
                        styles.statusChip,
                        item.status === s && styles.statusChipActive,
                        item.status === s && s === 'unlisted' && styles.statusChipActiveUnlisted,
                        item.status === s && s === 'listed' && styles.statusChipActiveListed,
                        item.status === s && s === 'sold' && styles.statusChipActiveSold,
                      ]}
                      onPress={() => update({ status: item.status === s ? '' as any : s })}
                    >
                      <Text style={[styles.statusChipText, item.status === s && styles.statusChipTextActive]}>
                        {s === 'unlisted' ? 'Unlisted' : s === 'listed' ? 'Listed' : 'Sold'}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </>
          )}
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Notes</Text>
            <TextInput
              style={styles.notesInput}
              value={item.notes}
              onChangeText={(t) => update({ notes: t })}
              placeholder="Notes..."
              placeholderTextColor={theme.colors.mauve}
              multiline
            />
          </View>
        </View>

        {!isCloset && item.status !== 'sold' && (
          <Pressable
            style={({ pressed }) => [styles.markSoldBtn, pressed && styles.btnPressed]}
            onPress={handleMarkSold}
          >
            <Text style={styles.markSoldBtnText}>Mark as Sold</Text>
          </Pressable>
        )}

      </ScrollView>

      {Platform.OS === 'ios' && (
        <InputAccessoryView nativeID={PRICE_INPUT_ACCESSORY_ID}>
          <View style={styles.priceInputAccessory}>
            <Pressable
              onPress={() => Keyboard.dismiss()}
              style={({ pressed }) => [styles.priceInputAccessoryDone, pressed && styles.btnPressed]}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Dismiss keyboard"
            >
              <Text style={styles.priceInputAccessoryDoneText}>Done</Text>
            </Pressable>
          </View>
        </InputAccessoryView>
      )}

      <Modal
        visible={addPhotoModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeAddPhotoModal}
        onDismiss={() => {
          if (pendingPhotoAction.current !== null) {
            const useCamera = pendingPhotoAction.current;
            pendingPhotoAction.current = null;
            void executeAddPhoto(useCamera);
          }
        }}
      >
        <View style={styles.addPhotoOverlay}>
          <Pressable
            style={styles.addPhotoBackdrop}
            onPress={closeAddPhotoModal}
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
          />
          <View style={styles.addPhotoSheet}>
            <Text style={styles.addPhotoTitle}>Add photo</Text>
            <Pressable
              style={({ pressed }) => [styles.addPhotoRow, pressed && styles.btnPressed]}
              onPress={() => {
                pendingPhotoAction.current = true;
                closeAddPhotoModal();
              }}
              accessibilityRole="button"
            >
              <AppIcon name="camera" size={22} color={theme.colors.vintageBlueDark} />
              <Text style={styles.addPhotoRowText}>Take photo</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.addPhotoRow, pressed && styles.btnPressed]}
              onPress={() => {
                pendingPhotoAction.current = false;
                closeAddPhotoModal();
              }}
              accessibilityRole="button"
            >
              <AppIcon name="images-outline" size={22} color={theme.colors.vintageBlueDark} />
              <Text style={styles.addPhotoRowText}>Choose from library</Text>
            </Pressable>
            <View style={styles.addPhotoSeparator} />
            <Pressable
              style={({ pressed }) => [styles.addPhotoCancelWrap, pressed && styles.btnPressed]}
              onPress={closeAddPhotoModal}
              accessibilityRole="button"
            >
              <Text style={styles.addPhotoCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={itemMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={closeItemMenu}
      >
        <View style={styles.itemMenuOverlay}>
          <TouchableWithoutFeedback
            onPress={closeItemMenu}
            accessibilityRole="button"
            accessibilityLabel="Dismiss menu"
          >
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
          <View style={[styles.itemMenuCard, { top: insets.top + 56, right: 12 }]}>
            {item?.intent === 'flip' && (
              <Pressable
                style={styles.itemMenuItem}
                onPress={() => {
                  closeItemMenu();
                  if (item?.id != null) {
                    updateItem(item.id, { intent: 'closet' });
                    showToast('Moved to Closet');
                    router.back();
                  }
                }}
              >
                <AppIcon name="shirt-outline" size={20} color={theme.colors.charcoal} />
                <Text style={styles.itemMenuItemText}>Move to Closet</Text>
              </Pressable>
            )}
            {item?.intent === 'closet' && (
              <Pressable
                style={styles.itemMenuItem}
                onPress={() => {
                  closeItemMenu();
                  if (item?.id != null) {
                    updateItem(item.id, { intent: 'flip' });
                    showToast('Moved to Flips');
                    router.back();
                  }
                }}
              >
                <AppIcon name="pricetag-outline" size={20} color={theme.colors.charcoal} />
                <Text style={styles.itemMenuItemText}>Move to Flips</Text>
              </Pressable>
            )}
            <Pressable
              style={styles.itemMenuItem}
              onPress={() => {
                closeItemMenu();
                handleShare();
              }}
            >
              <AppIcon name="share-outline" size={20} color={theme.colors.charcoal} />
              <Text style={styles.itemMenuItemText}>Share</Text>
            </Pressable>
            <Pressable
              style={[styles.itemMenuItem, styles.itemMenuItemDestructive]}
              onPress={() => { closeItemMenu(); handleDeleteConfirm(); }}
            >
              <AppIcon name="trash-outline" size={20} color={theme.colors.terra} />
              <Text style={[styles.itemMenuItemText, styles.itemMenuItemTextDestructive]}>Delete</Text>
            </Pressable>
            <View style={styles.itemMenuSeparator} />
            <Pressable style={styles.itemMenuItemCancel} onPress={closeItemMenu}>
              <Text style={styles.itemMenuItemTextSecondary}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={scanHistoryVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setScanHistoryVisible(false)}
      >
        <Pressable style={styles.itemMenuOverlay} onPress={() => setScanHistoryVisible(false)}>
          <Pressable style={[styles.historyCard, { top: insets.top + 56, right: 12 }]} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.historyTitle}>Previous scans</Text>
            <ScrollView style={styles.historyList}>
              {snapshots.map((snapshot) => {
                const isActive = snapshot.id === activeSnapshot?.id;
                return (
                  <Pressable
                    key={snapshot.id}
                    style={[styles.historyRow, isActive && styles.historyRowActive]}
                    onPress={() => switchActiveSnapshot(snapshot.id)}
                    accessibilityRole="button"
                  >
                    <View style={styles.historyRowMain}>
                      <Text style={styles.historyRowTime}>{formatSnapshotTime(snapshot.createdAt)}</Text>
                      <Text style={styles.historyRowMeta}>
                        {snapshot.profit || 'No profit'}
                        {snapshot.confidence ? (
                          <Text>
                            <Text style={styles.historyRowMeta}> · </Text>
                            <Text
                              style={[
                                styles.historyRowMeta,
                                { color: getConfidenceColor(theme, snapshot.confidence) },
                              ]}
                            >
                              {snapshot.confidence}
                            </Text>
                          </Text>
                        ) : null}
                      </Text>
                    </View>
                    {isActive && <Text style={styles.historyActiveTag}>Active</Text>}
                  </Pressable>
                );
              })}
            </ScrollView>
            <Pressable style={styles.itemMenuItemCancel} onPress={() => setScanHistoryVisible(false)}>
              <Text style={styles.itemMenuItemTextSecondary}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={imageFullScreenVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setImageFullScreenVisible(false)}
      >
        <Pressable
          style={styles.imageFullScreenOverlay}
          onPress={() => setImageFullScreenVisible(false)}
        >
          <Animated.View
            style={[
              styles.imageFullScreenSwipeWrap,
              { transform: [{ translateY: imageFullScreenTranslateY }] },
            ]}
            {...imageFullScreenPanResponder.panHandlers}
          >
            <ScrollView
              ref={fullScreenScrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              style={styles.imageFullScreenScroll}
              onMomentumScrollEnd={(e) => {
                setPhotoIndex(Math.round(e.nativeEvent.contentOffset.x / screenWidth));
              }}
            >
              {photos.map((uri, i) => (
                <Pressable
                  key={`${uri}-${i}`}
                  style={[styles.imageFullScreenContent, { width: screenWidth }]}
                  onPress={(e) => e.stopPropagation()}
                >
                  <Image source={{ uri }} style={styles.imageFullScreenImg} resizeMode="contain" />
                </Pressable>
              ))}
            </ScrollView>
            {photos.length > 1 && (
              <View pointerEvents="none" style={[styles.imageFullScreenCount, { top: (insets.top || 0) + 12 }]}>
                <Text style={styles.imageFullScreenCountText}>{photoIndex + 1} / {photos.length}</Text>
              </View>
            )}
            <Pressable
              style={[styles.imageFullScreenClose, { paddingTop: insets.top + 8 }]}
              onPress={() => setImageFullScreenVisible(false)}
              accessibilityLabel="Close"
            >
              <AppIcon name="close" size={28} color={theme.colors.cream} />
            </Pressable>
            <View style={[styles.imageFullScreenActions, { paddingBottom: insets.bottom + 16 }]}>
              {photos.length > 1 && photoIndex !== 0 && (
                <Pressable
                  style={styles.imageFullScreenActionBtn}
                  onPress={() => {
                    const reordered = [photos[photoIndex], ...photos.filter((_, i) => i !== photoIndex)];
                    updateItem(item.id, { photos: reordered, img: reordered[0] });
                    update({ photos: reordered, img: reordered[0] });
                    setPhotoIndex(0);
                    setTimeout(() => fullScreenScrollRef.current?.scrollTo({ x: 0, animated: true }), 0);
                    showToast('Cover photo updated');
                  }}
                  accessibilityLabel="Set as cover photo"
                >
                  <AppIcon name="image-outline" size={20} color={theme.colors.cream} />
                  <Text style={styles.imageFullScreenSaveText}>Set as cover</Text>
                </Pressable>
              )}
              {Platform.OS !== 'web' && (
                <Pressable
                  style={styles.imageFullScreenActionBtn}
                  onPress={handleSaveImageToCameraRoll}
                  accessibilityLabel="Save to camera roll"
                >
                  <AppIcon name="download-outline" size={22} color={theme.colors.cream} />
                  <Text style={styles.imageFullScreenSaveText}>Save</Text>
                </Pressable>
              )}
              <Pressable
                style={styles.imageFullScreenActionBtn}
                onPress={() => {
                  setImageFullScreenVisible(false);
                  handleRemovePhoto(photoIndex);
                }}
                accessibilityLabel="Delete photo"
              >
                <AppIcon name="trash-outline" size={20} color={theme.colors.cream} />
                <Text style={styles.imageFullScreenSaveText}>Delete</Text>
              </Pressable>
            </View>
          </Animated.View>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function FieldRow({
  label,
  value,
  prefix = '',
  onChangeText,
  editable = true,
  keyboardType,
  placeholder,
  styles,
  theme,
}: {
  label: string;
  value: string;
  prefix?: string;
  onChangeText?: (t: string) => void;
  editable?: boolean;
  keyboardType?: 'decimal-pad' | 'default';
  placeholder?: string;
  styles: ReturnType<typeof createStyles>;
  theme: Theme;
}) {
  const displayValue = prefix ? `${prefix}${value}` : value;
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {editable ? (
        <TextInput
          style={styles.fieldInput}
          value={displayValue}
          onChangeText={(t) => onChangeText?.(t.replace(prefix, '').trim())}
          keyboardType={keyboardType}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.mauve}
        />
      ) : (
        <Text style={styles.fieldValue}>{value}</Text>
      )}
    </View>
  );
}

function createStyles(theme: Theme, formMaxWidth?: number) {
  const centered = formMaxWidth
    ? { maxWidth: formMaxWidth, alignSelf: 'center' as const, width: '100%' as const }
    : {};
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.cream,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.lavender,
  },
  headerBtn: {
    padding: 8,
    minWidth: theme.minTouchTargetSize,
    minHeight: theme.minTouchTargetSize,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    ...theme.typography.body,
    fontWeight: '600',
    color: theme.colors.charcoal,
    textAlign: 'center',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  headerTitleInput: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.vintageBlueDark,
    paddingVertical: 2,
    minWidth: 120,
  },
  headerSub: {
    ...theme.typography.caption,
    color: theme.colors.mauve,
    textAlign: 'center',
    marginTop: 1,
  },
  addPhotoOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addPhotoBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  addPhotoSheet: {
    backgroundColor: theme.colors.cream,
    borderRadius: theme.radius.xl,
    paddingHorizontal: theme.spacing.xxl,
    paddingTop: theme.spacing.xxl,
    paddingBottom: theme.spacing.lg,
    marginHorizontal: theme.spacing.xl,
    width: '90%',
    maxWidth: 400,
    ...(theme.shadows.md ?? {}),
  },
  addPhotoTitle: {
    ...theme.typography.h2,
    color: theme.colors.charcoal,
    marginBottom: theme.spacing.md,
  },
  addPhotoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    minHeight: theme.minTouchTargetSize,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surface,
    marginBottom: theme.spacing.sm,
    ...(theme.shadows.sm ?? {}),
  },
  addPhotoRowText: {
    ...theme.typography.body,
    fontWeight: '600',
    color: theme.colors.charcoal,
  },
  addPhotoSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.surfaceVariant,
    marginVertical: theme.spacing.sm,
  },
  addPhotoCancelWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
    minHeight: theme.minTouchTargetSize,
  },
  addPhotoCancelText: {
    ...theme.typography.body,
    color: theme.colors.mauve,
    fontWeight: '600',
  },
  itemMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  itemMenuCard: {
    position: 'absolute',
    zIndex: 1,
    minWidth: 180,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    paddingVertical: 4,
    ...(theme.shadows.md ?? {}),
  },
  itemMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: theme.minTouchTargetSize,
  },
  itemMenuItemText: {
    ...theme.typography.body,
    color: theme.colors.charcoal,
  },
  itemMenuItemTextSecondary: {
    ...theme.typography.body,
    color: theme.colors.mauve,
  },
  itemMenuSeparator: {
    height: 1,
    backgroundColor: theme.colors.surfaceVariant,
    marginHorizontal: 12,
    marginVertical: 4,
  },
  itemMenuItemCancel: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: theme.minTouchTargetSize,
  },
  itemMenuItemDestructive: {},
  historyCard: {
    position: 'absolute',
    minWidth: 240,
    maxWidth: 320,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    paddingTop: 8,
    ...(theme.shadows.md ?? {}),
  },
  historyTitle: {
    ...theme.typography.bodySmall,
    color: theme.colors.charcoal,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  historyList: {
    maxHeight: 260,
    paddingHorizontal: 8,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: theme.radius.sm,
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginBottom: 4,
  },
  historyRowActive: {
    backgroundColor: theme.colors.surfaceVariant,
  },
  historyRowMain: {
    flex: 1,
  },
  historyRowTime: {
    ...theme.typography.caption,
    color: theme.colors.charcoal,
    fontWeight: '600',
  },
  historyRowMeta: {
    ...theme.typography.caption,
    color: theme.colors.mauve,
    marginTop: 2,
  },
  historyActiveTag: {
    ...theme.typography.label,
    color: theme.colors.vintageBlueDark,
  },
  itemMenuItemTextDestructive: {
    color: theme.colors.terra,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    ...centered,
  },
  priceInputAccessory: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.surfaceVariant,
  },
  priceInputAccessoryDone: {
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    minHeight: theme.minTouchTargetSize,
    justifyContent: 'center',
  },
  priceInputAccessoryDoneText: {
    ...theme.typography.body,
    fontWeight: '600',
    color: theme.colors.vintageBlueDark,
  },
  galleryWrap: {
    marginTop: 24,
    width: '100%',
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    backgroundColor: theme.colors.surfaceVariant,
    aspectRatio: 1,
  },
  galleryPage: {
    overflow: 'hidden',
  },
  galleryEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: theme.colors.surfaceVariant,
  },
  galleryEmptyTitle: {
    ...theme.typography.bodySmall,
    fontWeight: '600',
    color: theme.colors.charcoal,
    marginTop: 8,
  },
  galleryEmptySub: {
    ...theme.typography.caption,
    color: theme.colors.mauve,
  },
  imgPressable: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  img: {
    width: '100%',
    height: '100%',
    backgroundColor: theme.colors.surfaceVariant,
  },
  galleryAddBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryDots: {
    position: 'absolute',
    bottom: 10,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  photoDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  photoDotActive: {
    backgroundColor: theme.colors.onPrimary,
    width: 16,
  },
  removePhotoBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageFullScreenOverlay: {
    flex: 1,
    backgroundColor: theme.colors.charcoal,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageFullScreenSwipeWrap: {
    flex: 1,
    width: '100%',
  },
  imageFullScreenScroll: {
    flex: 1,
  },
  imageFullScreenContent: {
    flex: 1,
    justifyContent: 'center',
  },
  imageFullScreenCount: {
    position: 'absolute',
    alignSelf: 'center',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  imageFullScreenCountText: {
    ...theme.typography.caption,
    color: theme.colors.cream,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
    overflow: 'hidden',
  },
  imageFullScreenImg: {
    width: '100%',
    flex: 1,
  },
  imageFullScreenClose: {
    position: 'absolute',
    top: 0,
    right: 0,
    padding: 16,
  },
  imageFullScreenActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  imageFullScreenActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  imageFullScreenSaveText: {
    ...theme.typography.bodySmall,
    color: theme.colors.cream,
    fontWeight: '600',
  },
  badge: {
    position: 'absolute',
    top: 20,
    left: 20,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.sm,
  },
  badgeText: {
    ...theme.typography.bodySmall,
    fontWeight: '600',
    color: theme.colors.charcoal,
  },
  badgeSold: {
    backgroundColor: theme.colors.profit,
  },
  badgeUnlisted: {
    backgroundColor: '#C8E6E4',
  },
  badgeListed: {
    backgroundColor: theme.colors.vintageBlueDark,
  },
  badgeTextSold: {
    color: theme.colors.onPrimary,
  },
  badgeTextUnlisted: {
    color: '#1A5C59',
  },
  badgeTextListed: {
    color: theme.colors.onPrimary,
  },
  profitStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: theme.colors.surface,
    marginTop: 16,
    marginBottom: 20,
    borderRadius: theme.radius.md,
    ...(theme.shadows.sm ?? {}),
  },
  insightsWrap: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.surfaceVariant,
    marginBottom: 20,
    ...(theme.shadows.sm ?? {}),
  },
  insightsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  insightsHeaderLeft: {
    flex: 1,
  },
  insightsHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  insightsTitle: {
    ...theme.typography.bodySmall,
    color: theme.colors.charcoal,
    fontWeight: '600',
  },
  insightsMeta: {
    ...theme.typography.caption,
    color: theme.colors.mauve,
    marginTop: 2,
  },
  insightsCountBadge: {
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.surfaceVariant,
    backgroundColor: theme.colors.surfaceVariant,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 3,
  },
  insightsCountText: {
    ...theme.typography.caption,
    color: theme.colors.charcoal,
  },
  insightsContent: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.surfaceVariant,
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    paddingTop: theme.spacing.sm,
  },
  insightsTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  insightsProfit: {
    ...theme.typography.bodySmall,
    color: theme.colors.profit,
    fontWeight: '700',
  },
  insightsConfidence: {
    ...theme.typography.caption,
    fontWeight: '600',
  },
  insightsSub: {
    ...theme.typography.caption,
    color: theme.colors.mauve,
    marginTop: theme.spacing.xs,
    lineHeight: 20,
  },
  insightsIdeas: {
    marginTop: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  insightIdeaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
  },
  insightIdeaBody: {
    flex: 1,
    minWidth: 0,
  },
  insightIdeaText: {
    ...theme.typography.bodySmall,
    color: theme.colors.charcoal,
    lineHeight: 20,
  },
  insightIdeaProfit: {
    ...theme.typography.caption,
    color: theme.colors.profit,
    marginTop: 4,
  },
  insightsEmptyIdeas: {
    ...theme.typography.caption,
    color: theme.colors.mauve,
  },
  historyBtn: {
    marginTop: theme.spacing.sm,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: theme.colors.surfaceVariant,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    minHeight: theme.minTouchTargetSize,
    justifyContent: 'center',
  },
  historyBtnText: {
    ...theme.typography.caption,
    color: theme.colors.vintageBlueDark,
    fontWeight: '600',
  },
  profitStripBlock: {
    alignItems: 'center',
    flex: 1,
  },
  profitStripVal: {
    ...theme.typography.body,
    fontWeight: '700',
    color: theme.colors.charcoal,
  },
  profitStripRoiInfinity: {
    fontSize: 22,
    lineHeight: 26,
    paddingTop: 1,
  },
  profitStripInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profitStripInput: {
    ...theme.typography.body,
    fontWeight: '700',
    color: theme.colors.charcoal,
    minWidth: 36,
    maxWidth: 72,
    padding: 0,
    textAlign: 'center',
  },
  profitStripLabel: {
    ...theme.typography.label,
    color: theme.colors.mauve,
    marginTop: 2,
  },
  profitStripDivider: {
    width: 1,
    height: 24,
    backgroundColor: theme.colors.surfaceVariant,
  },
  profitPos: {
    color: theme.colors.profit,
  },
  profitNeg: {
    color: '#C0392B',
  },
  fields: {
  },
  fieldRow: {
    marginBottom: 16,
  },
  fieldLabel: {
    ...theme.typography.label,
    color: theme.colors.mauve,
    marginBottom: 4,
  },
  fieldInput: {
    ...theme.typography.body,
    color: theme.colors.charcoal,
    backgroundColor: theme.colors.surface,
    padding: 12,
    borderRadius: theme.radius.sm,
    ...(theme.shadows.sm ?? {}),
  },
  fieldHint: {
    ...theme.typography.caption,
    color: theme.colors.mauve,
    marginTop: 6,
    lineHeight: 18,
  },
  fieldValue: {
    ...theme.typography.body,
    color: theme.colors.charcoal,
  },
  platformRowScrollView: {},
  platformRowScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: theme.spacing.section,
  },
  platformChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.surfaceVariant,
  },
  platformChipActive: {
    backgroundColor: theme.colors.vintageBlue,
    borderColor: theme.colors.vintageBlue,
  },
  platformChipText: {
    ...theme.typography.caption,
    color: theme.colors.mauve,
  },
  platformChipTextActive: {
    color: theme.colors.onPrimary,
    fontWeight: '600',
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceVariant,
  },
  statusChipActive: {
    backgroundColor: theme.colors.vintageBlueDark,
  },
  statusChipActiveUnlisted: {
    backgroundColor: theme.colors.vintageBlue,
  },
  statusChipActiveListed: {
    backgroundColor: theme.colors.vintageBlueDark,
  },
  statusChipActiveSold: {
    backgroundColor: theme.colors.profit,
  },
  statusChipText: {
    ...theme.typography.caption,
    color: theme.colors.mauve,
  },
  statusChipTextActive: {
    color: theme.colors.onPrimary,
  },
  notesInput: {
    ...theme.typography.body,
    color: theme.colors.charcoal,
    backgroundColor: theme.colors.surface,
    padding: 12,
    borderRadius: theme.radius.sm,
    minHeight: 80,
    textAlignVertical: 'top',
    ...(theme.shadows.sm ?? {}),
  },
  markSoldBtn: {
    marginTop: 8,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.vintageBlueDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPressed: {
    opacity: 0.9,
  },
  markSoldBtnText: {
    ...theme.typography.body,
    fontWeight: '600',
    color: theme.colors.onPrimary,
  },
  photoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 24,
    marginBottom: 24,
    minHeight: theme.minTouchTargetSize,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.vintageBlueDark,
    backgroundColor: 'transparent',
  },
  photoBtnText: {
    ...theme.typography.body,
    fontWeight: '600',
    color: theme.colors.vintageBlueDark,
  },
  errorWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    ...theme.typography.h2,
    color: theme.colors.charcoal,
    marginBottom: 16,
  },
  errorBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: theme.colors.vintageBlueDark,
    borderRadius: theme.radius.md,
  },
  errorBtnText: {
    ...theme.typography.body,
    fontWeight: '600',
    color: theme.colors.onPrimary,
  },
  });
}
