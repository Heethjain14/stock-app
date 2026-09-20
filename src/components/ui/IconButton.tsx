import React from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, layout } from '../../theme';
import type { IconName } from './Button';

export type IconButtonProps = {
  icon: IconName;
  onPress?: () => void;
  /** Required: describes the action for screen readers. */
  accessibilityLabel: string;
  size?: number;
  color?: string;
  filled?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  size = 22,
  color = colors.text,
  filled = false,
  disabled = false,
  style,
}: IconButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      hitSlop={6}
      style={({ pressed }) => [
        styles.base,
        filled && styles.filled,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Ionicons name={icon} size={size} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: layout.minTouch,
    height: layout.minTouch,
    borderRadius: layout.minTouch / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filled: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  pressed: { backgroundColor: colors.surfaceMuted },
  disabled: { opacity: 0.45 },
});
