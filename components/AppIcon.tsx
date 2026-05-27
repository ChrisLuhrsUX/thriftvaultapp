import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import type { ComponentProps } from 'react';

type IoniconsName = ComponentProps<typeof Ionicons>['name'];

interface AppIconProps {
  name: IoniconsName;
  size?: number;
  color?: string;
  style?: ComponentProps<typeof Ionicons>['style'];
  /** Set when the icon is the only thing communicating meaning (e.g. a standalone
   * icon-only button). When omitted, the icon is treated as decorative and hidden
   * from VoiceOver/TalkBack so it doesn't pollute the accessibility tree. */
  accessibilityLabel?: string;
}

export function AppIcon({ name, size = 24, color, style, accessibilityLabel }: AppIconProps) {
  const decorative = !accessibilityLabel;
  return (
    <Ionicons
      name={name}
      size={size}
      color={color}
      style={style}
      accessible={!decorative}
      accessibilityLabel={accessibilityLabel}
      accessibilityElementsHidden={decorative}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'yes'}
    />
  );
}
