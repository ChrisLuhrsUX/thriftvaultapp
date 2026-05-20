import { useTheme } from '@/context/ThemeContext';
import React from 'react';
import { Pressable, Text } from 'react-native';

type Variant = 'accent' | 'muted' | 'danger' | 'neutral';

interface InlinePromptButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  textColor?: string;
  accessibilityLabel?: string;
}

export function InlinePromptButton({
  label,
  onPress,
  variant = 'accent',
  textColor,
  accessibilityLabel,
}: InlinePromptButtonProps) {
  const { theme } = useTheme();

  const bgByVariant: Record<Variant, string> = {
    accent: theme.colors.terraLight,
    muted: theme.colors.mauveLight,
    danger: theme.colors.surface,
    neutral: theme.colors.surface,
  };
  const textByVariant: Record<Variant, string> = {
    accent: theme.colors.terra,
    muted: theme.colors.mauve,
    danger: theme.colors.loss,
    neutral: theme.colors.mauve,
  };

  return (
    <Pressable
      style={({ pressed }) => [
        {
          justifyContent: 'center',
          paddingVertical: 6,
          paddingHorizontal: 10,
          borderRadius: theme.radius.full,
          backgroundColor: bgByVariant[variant],
        },
        pressed && { opacity: theme.pressedOpacity.default },
      ]}
      onPress={onPress}
      hitSlop={12}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
    >
      <Text
        style={{
          ...theme.typography.caption,
          fontWeight: '600',
          color: textColor ?? textByVariant[variant],
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
