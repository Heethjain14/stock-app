import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radii, shadows, spacing } from '../../theme';

export type CardProps = {
  children: React.ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  /** Inner padding (default 16). Use 0 for stacked ListRows. */
  padding?: number;
  style?: StyleProp<ViewStyle>;
};

export function Card({ children, onPress, accessibilityLabel, padding = spacing.lg, style }: CardProps) {
  if (!onPress) {
    return <View style={[styles.card, { padding }, style]}>{children}</View>;
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.card, { padding }, pressed && styles.pressed, style]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadows.sm,
  },
  pressed: { backgroundColor: colors.surfaceMuted },
});
