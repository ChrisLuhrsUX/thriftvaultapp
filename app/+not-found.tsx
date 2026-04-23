import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { theme } from '@/theme';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View style={styles.container}>
        <Text style={styles.title}>This screen doesn't exist.</Text>

        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Go to home screen!</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
    backgroundColor: theme.colors.cream,
  },
  title: {
    ...theme.typography.h2,
    color: theme.colors.charcoal,
  },
  link: {
    marginTop: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
  },
  linkText: {
    ...theme.typography.body,
    color: theme.colors.vintageBlueDark,
  },
});
