import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';

const ONBOARDING_KEY = 'tv_onboarding_done';

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY).then((v) => {
      if (v === '1') {
        router.replace('/(tabs)');
      } else {
        router.replace('/onboarding');
      }
    });
  }, [router]);

  return null;
}
