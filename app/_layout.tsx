import {
  PlayfairDisplay_400Regular,
  PlayfairDisplay_700Bold,
} from '@expo-google-fonts/playfair-display';
import { DMSans_400Regular, DMSans_600SemiBold } from '@expo-google-fonts/dm-sans';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Platform, StatusBar as RNStatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { StatusBar } from '@/components/StatusBar';
import { Toast } from '@/components/Toast';
import { InventoryProvider } from '@/context/InventoryContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { ToastProvider } from '@/context/ToastContext';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  initialRouteName: 'index',
};

export default function RootLayout() {
  const [loaded, error] = useFonts({
    PlayfairDisplay_400Regular,
    PlayfairDisplay_700Bold,
    DMSans_400Regular,
    DMSans_600SemiBold,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <InventoryProvider>
          <ToastProvider>
          {Platform.OS !== 'web' && <RNStatusBar hidden={false} />}
          <View style={rootStyles.flex}>
            {Platform.OS !== 'web' && <StatusBar />}
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="onboarding" options={{ animation: 'none' }} />
              <Stack.Screen name="(tabs)" options={{ animation: 'none' }} />
              <Stack.Screen
                name="detail"
                options={{
                  animation: 'slide_from_right',
                }}
              />
              <Stack.Screen
                name="haul-detail"
                options={{
                  animation: 'slide_from_right',
                }}
              />
            </Stack>
            <Toast />
          </View>
        </ToastProvider>
      </InventoryProvider>
    </ThemeProvider>
    </SafeAreaProvider>
  );
}

const rootStyles = StyleSheet.create({
  flex: { flex: 1 },
});
