import { useTheme } from '@/context/ThemeContext';
import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { AppIcon } from './AppIcon';
import { Button } from './Button';

type IconName = React.ComponentProps<typeof AppIcon>['name'];

interface EmptyStateAction {
  label: string;
  onPress: () => void;
  icon?: IconName;
  iconPosition?: 'left' | 'right';
  variant?: 'primary' | 'ghost';
}

interface EmptyStateProps {
  icon?: IconName;
  decoration?: React.ReactNode;
  title: string;
  body: string;
  action?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  compact?: boolean;
  style?: ViewStyle;
}

export function EmptyState({
  icon,
  decoration,
  title,
  body,
  action,
  secondaryAction,
  compact = false,
  style,
}: EmptyStateProps) {
  const { theme } = useTheme();

  const containerPadding = compact ? theme.spacing.lg : theme.spacing.xxl;
  const iconSize = compact ? 28 : 48;
  const titleStyle = compact ? theme.typography.bodySmall : theme.typography.h2;
  const titleGap = compact ? theme.spacing.sm : theme.spacing.lg;

  return (
    <View
      style={[
        styles.container,
        { padding: containerPadding },
        style,
      ]}
    >
      {decoration ? (
        <View style={{ marginBottom: titleGap }}>{decoration}</View>
      ) : icon ? (
        <AppIcon
          name={icon}
          size={iconSize}
          color={theme.colors.mauve}
          style={{ marginBottom: titleGap }}
        />
      ) : null}

      <Text
        style={[
          titleStyle,
          {
            color: theme.colors.charcoal,
            textAlign: 'center',
            fontWeight: '600',
          },
        ]}
      >
        {title}
      </Text>

      <Text
        style={{
          ...theme.typography.bodySmall,
          color: theme.colors.mauve,
          textAlign: 'center',
          marginTop: theme.spacing.sm,
          lineHeight: 20,
        }}
      >
        {body}
      </Text>

      {action && (
        <Button
          label={action.label}
          onPress={action.onPress}
          icon={action.icon}
          iconPosition={action.iconPosition}
          variant={action.variant ?? 'primary'}
          style={{ marginTop: theme.spacing.xl }}
        />
      )}

      {secondaryAction && (
        <Button
          label={secondaryAction.label}
          onPress={secondaryAction.onPress}
          icon={secondaryAction.icon}
          iconPosition={secondaryAction.iconPosition}
          variant={secondaryAction.variant ?? 'ghost'}
          style={{ marginTop: theme.spacing.md }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
