import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import type { ComponentProps } from 'react';

type IoniconsName = ComponentProps<typeof Ionicons>['name'];

interface AppIconProps {
  name: IoniconsName;
  size?: number;
  color?: string;
  style?: ComponentProps<typeof Ionicons>['style'];
}

export function AppIcon({ name, size = 24, color, style }: AppIconProps) {
  return <Ionicons name={name} size={size} color={color} style={style} />;
}
