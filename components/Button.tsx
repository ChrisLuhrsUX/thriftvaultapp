import { useTheme } from '@/context/ThemeContext';
import React from 'react';
import { ActivityIndicator, Pressable, Text, type ViewStyle } from 'react-native';
import { AppIcon } from './AppIcon';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'md' | 'lg';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  icon?: React.ComponentProps<typeof AppIcon>['name'];
  iconPosition?: 'left' | 'right';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  disabled = false,
  loading = false,
  style,
  accessibilityLabel,
  accessibilityHint,
}: ButtonProps) {
  const { theme } = useTheme();
  const isFilled = variant === 'primary';
  const isOutline = variant === 'secondary';
  const bg = isFilled ? theme.colors.vintageBlueDark : 'transparent';
  const textColor = isFilled ? theme.colors.onPrimary : theme.colors.vintageBlueDark;
  const height = size === 'lg' ? 56 : 48;
  const paddingH = size === 'lg' ? theme.spacing.xxl : theme.spacing.xl;

  return (
    <Pressable
      style={({ pressed }) => [
        {
          height,
          paddingHorizontal: paddingH,
          borderRadius: theme.radius.sm,
          backgroundColor: bg,
          borderWidth: isOutline ? 1 : 0,
          borderColor: isOutline ? theme.colors.vintageBlueDark : 'transparent',
          flexDirection: 'row' as const,
          alignItems: 'center' as const,
          justifyContent: 'center' as const,
          gap: theme.spacing.sm,
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
        },
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : (
        <>
          {icon && iconPosition === 'left' && (
            <AppIcon name={icon} size={18} color={textColor} />
          )}
          <Text
            style={{
              ...theme.typography.body,
              fontFamily: 'DMSans_600SemiBold',
              fontWeight: '600',
              color: textColor,
            }}
          >
            {label}
          </Text>
          {icon && iconPosition === 'right' && (
            <AppIcon name={icon} size={18} color={textColor} />
          )}
        </>
      )}
    </Pressable>
  );
}
