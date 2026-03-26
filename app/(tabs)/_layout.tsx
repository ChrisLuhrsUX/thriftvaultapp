import { Tabs } from 'expo-router';
import { Platform, View } from 'react-native';
import { CustomTabBar } from '@/components/CustomTabBar';
import { WebSidebar } from '@/components/WebSidebar';
import { useResponsive } from '@/hooks/useResponsive';

export default function TabLayout() {
  const { isDesktop } = useResponsive();

  if (Platform.OS === 'web' && isDesktop) {
    return (
      <View style={{ flex: 1, flexDirection: 'row' }}>
        <WebSidebar />
        <View style={{ flex: 1 }}>
          <Tabs
            tabBar={() => null}
            screenOptions={{ headerShown: false }}
          >
            <Tabs.Screen name="index" options={{ title: 'My Vault' }} />
            <Tabs.Screen name="scan" options={{ title: 'Scan' }} />
            <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
          </Tabs>
        </View>
      </View>
    );
  }

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" options={{ title: 'My Vault' }} />
      <Tabs.Screen name="scan" options={{ title: 'Scan' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
