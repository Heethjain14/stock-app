import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, layout, radii, shadows, typography } from '../../theme';

export type SegmentOption<T extends string> = { value: T; label: string };

export type SegmentedControlProps<T extends string> = {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
};

export function SegmentedControl<T extends string>({ options, value, onChange }: SegmentedControlProps<T>) {
  return (
    <View style={styles.track} accessibilityRole="tablist">
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityLabel={o.label}
            accessibilityState={{ selected }}
            style={({ pressed }) => [
              styles.segment,
              selected && styles.selected,
              pressed && !selected && styles.pressed,
            ]}
          >
            <Text
              style={[styles.text, { color: selected ? colors.primary : colors.textSecondary }]}
              numberOfLines={1}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segment: {
    flex: 1,
    minHeight: layout.minTouch - 6,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  selected: { backgroundColor: colors.surface, ...shadows.sm },
  pressed: { backgroundColor: colors.border },
  text: { ...typography.caption, fontWeight: '600' },
});
