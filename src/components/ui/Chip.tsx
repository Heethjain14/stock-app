import React from 'react';
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radii, spacing, typography } from '../../theme';

export type ChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Chip({ label, selected = false, onPress, disabled = false, style }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
      style={({ pressed }) => [
        styles.base,
        selected ? styles.selected : styles.idle,
        pressed && (selected ? styles.selectedPressed : styles.idlePressed),
        disabled && { opacity: 0.45 },
        style,
      ]}
    >
      <Text style={[styles.text, { color: selected ? colors.onPrimary : colors.text }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 40,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  idle: { backgroundColor: colors.surface, borderColor: colors.border },
  idlePressed: { backgroundColor: colors.surfaceMuted },
  selected: { backgroundColor: colors.primary, borderColor: colors.primary },
  selectedPressed: { backgroundColor: colors.primaryPressed },
  text: { ...typography.caption, fontWeight: '600' },
});
